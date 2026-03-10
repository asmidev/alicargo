import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Upload, FileText, AlertTriangle, Check, 
  Package, Ship, ChevronRight, Scale, DollarSign, Plus, FileSpreadsheet
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useFinanceCurrency } from '@/contexts/FinanceCurrencyContext';

// Set the worker source - use unpkg CDN which is reliable for pdfjs-dist 4.x
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface ParsedShipment {
  receiptNumber: string;
  status: string;
  totalWeight: number;
  totalVolume: number;
  totalShippingCost: number;
  estimatedArrival: string | null;
  boxes: ParsedBox[];
  isExisting: boolean;
}

interface ParsedBox {
  boxNumber: string;
  placeNumber: string;
  productDescription: string | null;
  packageType: string;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  volumeM3: number | null;
  shippingCost: number | null;
  storePhone: string | null;
  storeNumber: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  daysInTransit: number | null;
  status: string;
  location: string;
  isExisting: boolean;
  existingBoxId?: string; // Trek raqam orqali topilgan quti ID'si
}

interface ImportSummary {
  totalRows: number;
  shipmentsToCreate: number;
  shipmentsToUpdate: number;
  boxesNotFound: number;
  boxesToUpdate: number;
  boxesToCreate: number;
  totalWeight: number;
  totalVolume: number;
  totalShippingCost: number;
  reportType: 'in_transit' | 'arrived';
  warnings: string[];
  skippedBoxes: number; // Trek raqami topilmagan qutilar soni
  skippedTrackCodes: string[]; // O'tkazib yuborilgan trek raqamlar ro'yxati
}

interface PDFImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PDFImportDialog({ open, onOpenChange }: PDFImportDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const { usdToUzs } = useFinanceCurrency();
  const queryClient = useQueryClient();
  
  const [stage, setStage] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedData, setParsedData] = useState<ParsedShipment[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; created: number; warnings: string[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [rawText, setRawText] = useState('');
  const [fileType, setFileType] = useState<'pdf' | 'excel'>('pdf');
  
  const parseDate = (dateStr: string | number): string | null => {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') {
      const date = new Date((dateStr - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof dateStr === 'string' && dateStr.includes('.')) {
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        return `${year.length === 2 ? '20' + year : year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  const parseNumber = (value: string | number | undefined): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') return value;
    // Replace comma with dot for decimal point, then strip out anything not digit, dot, or minus
    const cleaned = String(value).replace(',', '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  };

  // Column mapping for AbuSaxiy PDF format
  const COLUMN_MAP: Record<string, string> = {
    'Дата приема': 'receiptDate',
    'Номер приема': 'receiptNumber',
    'Номер места': 'placeNumber',
    'Адрес магазина': 'storeAddress',
    'Трек код': 'trackCode',
    'Номер магазина': 'storeNumber',
    'Тел. Магазина': 'storePhone',
    'Наим. товара': 'productDescription',
    'Тип упаковки': 'packageType',
    'Кол-во мест': 'totalPlaces',
    'Вес': 'weight',
    'Длина': 'length',
    'Ширина': 'width',
    'Высота': 'height',
    'Объем': 'volume',
    'С': 'shippingCost',
    'Статус': 'status',
    'Расчётная дата прибытия': 'estimatedArrival',
  };

  // Parse table rows from PDF text items using positional parsing
  const parseTableRowsFromItems = (items: any[]): string[][] => {
    // Sort by Y position (descending - top to bottom in PDF), then X position
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) < 8) return a.transform[4] - b.transform[4];
      return yDiff;
    });

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let lastY: number | null = null;

    for (const item of sorted) {
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 8) {
        if (currentRow.length > 0) rows.push(currentRow);
        currentRow = [];
      }
      if (item.str.trim()) currentRow.push(item.str.trim());
      lastY = y;
    }
    if (currentRow.length > 0) rows.push(currentRow);

    return rows;
  };

  // Enhanced receipt number pattern - supports FS0066423, 1234567, etc.
  const isReceiptNumber = (value: string): boolean => {
    return /^([A-Z]{2,3}\d{5,}|\d{6,})$/i.test(value);
  };

  // Place number pattern - supports 1/4, 2/10, or simple numbers
  const parsePlaceNumber = (value: string): { place: string; total: number | null } => {
    const fractionMatch = value.match(/^(\d+)\/(\d+)$/);
    if (fractionMatch) {
      return { place: fractionMatch[1], total: parseInt(fractionMatch[2]) };
    }
    if (/^\d{1,3}$/.test(value)) {
      return { place: value, total: null };
    }
    return { place: value, total: null };
  };

  const extractDataFromPDFText = (text: string, tableRows?: string[][]) => {
    const rows: any[] = [];
    let reportType: 'in_transit' | 'arrived' = 'in_transit';

    if (text.includes('Доставлено') || text.includes('Дата прибытия') || text.includes('прибыл')) {
      reportType = 'arrived';
    }

    const processRowString = (rowText: string) => {
      // 1. Extract receipt number (usually starts with letters like FS, Y)
      // We make it strict so it doesn't accidentally match a tracking code
      const receiptMatch = rowText.match(/([A-Z]{1,3}\d{5,8})(?!\S)/i) || rowText.match(/\b([A-Z]{1,3}\d{5,8})\b/i);
      let receipt = receiptMatch && !receiptMatch[0].includes('.') ? receiptMatch[1] : null;
      
      // 2. Extract track code (usually longer, e.g. S70912854459, YT7599182013686, 78976003004869)
      const trackCodeMatch = rowText.match(/\b([A-Z0-9]{10,25})\b/i);
      let trackCode = trackCodeMatch ? trackCodeMatch[1] : null;

      // If we found a track code but no receipt, the receipt regex might have missed it,
      // or the row might not contain a receipt. If receipt and track code are exactly the same, it's fine.
      if (receipt === trackCode) {
         // Sometimes they are the same (e.g. tracking code used as receipt)
      } else if (receipt && trackCode && receipt.length > 10 && trackCode.length < 10) {
         // Probably swapped somehow, let's just make sure track code is the longer one
         const temp = receipt;
         receipt = trackCode;
         trackCode = temp;
      }

      // We need at least one identifier to process this row
      if (!receipt && !trackCode) return;
      
      const placeMatch = rowText.match(/(?:^|\s)(\d{1,3})\/(\d+)(?:\s|$)/);
      const place = placeMatch ? placeMatch[1] : '1';

      const packageTypes = ['Korobka', 'Meshok', 'Skotch', 'Yashik', 'Коробка', 'Мешок', 'Скотч', 'Ящик'];
      let matchedType = 'Korobka';
      let splitIndex = -1;
      
      for (const pt of packageTypes) {
        const idx = rowText.lastIndexOf(pt);
        if (idx > splitIndex) {
          splitIndex = idx;
          matchedType = pt;
        }
      }
      
      const cleanDates = (str: string) => str.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, '');

      if (splitIndex !== -1) {
        const metricsString = rowText.substring(splitIndex + matchedType.length);
        const cleanMetrics = cleanDates(metricsString);
        const numbers = cleanMetrics.match(/\b\d+([.,]\d+)?\b/g);
        
        if (numbers) {
          let weightRaw, lengthRaw, widthRaw, heightRaw, volumeRaw, costRaw;
          
          if (numbers.length >= 2) {
            // The first number after PackageType is always Places. 
            // The second number is ALWAYS Weight.
            weightRaw = numbers[1];
            
            // The rest depends on how many numbers we have.
            if (numbers.length >= 7) {
              // [Places, Weight, L, W, H, Vol, Cost]
              lengthRaw = numbers[2];
              widthRaw = numbers[3];
              heightRaw = numbers[4];
              volumeRaw = numbers[5];
              costRaw = numbers[6];
            } else if (numbers.length >= 4) {
              // [Places, Weight, Vol, Cost] or [Places, Weight, Vol]
              // If there are exactly 4 or 5 numbers, we assume L,W,H are missing.
              volumeRaw = numbers[numbers.length - 2];
              costRaw = numbers[numbers.length - 1];
            }
          }
          
          if (weightRaw) {
            rows.push({
              'Номер приема': receipt,
              'Трек код': trackCode,
              'Номер места': place,
              'Тип упаковки': matchedType,
              'Вес': weightRaw,
              'Длина': lengthRaw || null,
              'Ширина': widthRaw || null,
              'Высота': heightRaw || null,
              'Объем': volumeRaw || null,
              'С': costRaw || null,
              'Статус': rowText.includes('В пути') ? 'in_transit' : 'arrived'
            });
            return;
          }
        }
      }
      
      // Ultimate fallback: Just reading left-to-right numbers in the line generally
      const cleanWholeRow = cleanDates(rowText);
      const allNumbers = cleanWholeRow.match(/\b\d+([.,]\d+)?\b/g);
      if (allNumbers && allNumbers.length >= 2) {
        // Try to assume [Places, Weight, ...]
        let weightIdx = 1;
        // if the first number is a long tracking code or receipt, skip it
        if (allNumbers[0].length >= 6) {
           weightIdx = 2; // [Receipt, Places, Weight]
        }
        if (allNumbers.length > weightIdx) {
          rows.push({
            'Номер приема': receipt,
            'Трек код': trackCode,
            'Номер места': place,
            'Тип упаковки': 'Korobka',
            'Вес': allNumbers[weightIdx],
            'Длина': allNumbers.length >= weightIdx + 4 ? allNumbers[weightIdx + 1] : null,
            'Ширина': allNumbers.length >= weightIdx + 4 ? allNumbers[weightIdx + 2] : null,
            'Высота': allNumbers.length >= weightIdx + 4 ? allNumbers[weightIdx + 3] : null,
            'Объем': allNumbers.length >= weightIdx + 2 ? allNumbers[allNumbers.length - 2] : null,
            'С': allNumbers.length >= weightIdx + 1 ? allNumbers[allNumbers.length - 1] : null,
            'Статус': rowText.includes('В пути') ? 'in_transit' : 'arrived'
          });
        }
      }
    };

    if (tableRows && tableRows.length > 0) {
      let foundHeader = false;
      for (const row of tableRows) {
        const rowText = row.join(' ');
        if (!foundHeader && (rowText.includes('Номер приема') || rowText.includes('Дата приема') || rowText.includes('Kabul Numarası'))) {
          foundHeader = true;
          continue;
        }
        if (foundHeader && rowText.trim().length > 10) {
            processRowString(rowText);
        }
      }
    }
    
    if (rows.length === 0) {
      const lines = text.split('\n').filter(line => line.trim());
      for (const line of lines) {
         processRowString(line);
      }
    }

    return { rows, reportType };
  };

  // Extract data from Excel file
  const extractDataFromExcel = async (arrayBuffer: ArrayBuffer): Promise<{ rows: any[]; reportType: 'in_transit' | 'arrived'; rawText: string }> => {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    
    // Find header row
    let headerRowIdx = -1;
    let headers: string[] = [];
    
    for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
      const row = jsonData[i];
      if (Array.isArray(row) && row.some(cell => 
        String(cell || '').includes('Номер приема') || 
        String(cell || '').includes('Трек код') ||
        String(cell || '').includes('Номер магазина')
      )) {
        headerRowIdx = i;
        headers = row.map(h => String(h || '').trim());
        break;
      }
    }
    
    if (headerRowIdx === -1) {
      // Fallback: use first row as header
      headerRowIdx = 0;
      headers = (jsonData[0] || []).map((h: any) => String(h || '').trim());
    }
    
    // Debug: log detected headers
    console.log('AbuSaxiy Excel headers detected:', headers.map((h, i) => `[${i}]=${h}`).join(', '));
    
    // Detect translation row (Turkish/Uzbek) right after header and skip it
    let dataStartIdx = headerRowIdx + 1;
    if (dataStartIdx < jsonData.length) {
      const nextRow = jsonData[dataStartIdx];
      const nextRowStr = (nextRow || []).map((c: any) => String(c || '')).join(' ').toLowerCase();
      if (nextRowStr.includes('ağırlık') || nextRowStr.includes('uzunluk') || 
          nextRowStr.includes('genişlik') || nextRowStr.includes('takip kodu') ||
          nextRowStr.includes('paket sayısı') || nextRowStr.includes('mağaza') ||
          nextRowStr.includes('yükseklik') || nextRowStr.includes('hacim')) {
        console.log('AbuSaxiy Excel: skipping translation row at index', dataStartIdx);
        dataStartIdx = headerRowIdx + 2;
      }
    }
    
    // Create mapped rows
    const rows: any[] = [];
    let reportType: 'in_transit' | 'arrived' = 'in_transit';
    
    // Check for arrived report indicators
    const rawText = jsonData.map(row => (row || []).join(' ')).join('\n');
    if (rawText.includes('Доставлено') || rawText.includes('Дата прибытия') || rawText.includes('прибыл')) {
      reportType = 'arrived';
    }
    
    // Map data rows - start from dataStartIdx to skip translation row
    for (let i = dataStartIdx; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!Array.isArray(row) || row.length === 0) continue;
      
      const mappedRow: Record<string, any> = {};
      
      headers.forEach((header, idx) => {
        if (header && row[idx] !== undefined && row[idx] !== null && row[idx] !== '') {
          // Normalize header - remove extra spaces, Unicode normalization
          const normalizedHeader = String(header).trim().replace(/\s+/g, ' ');
          const headerLower = normalizedHeader.toLowerCase();
          
          // MUHIM: "Трек код" ni BIRINCHI tekshirish - bu eng muhim ustun!
          if (normalizedHeader === 'Трек код' || headerLower === 'трек код' || headerLower.includes('track')) {
            mappedRow['Трек код'] = String(row[idx]).trim();
          } else if (normalizedHeader.includes('Номер приема') || headerLower.includes('receipt') || normalizedHeader === 'Receipt Number') {
            mappedRow['Номер приема'] = row[idx];
          } else if (normalizedHeader.includes('Номер места') || headerLower.includes('place')) {
            mappedRow['Номер места'] = row[idx];
          } else if (normalizedHeader.includes('Номер магазина')) {
            mappedRow['Номер магазина'] = row[idx];
          } else if (normalizedHeader.includes('Тел') || headerLower.includes('phone')) {
            mappedRow['Тел. Магазина'] = row[idx];
          } else if (normalizedHeader.includes('Наим') || headerLower.includes('product') || headerLower.includes('description')) {
            mappedRow['Наим. товара'] = row[idx];
          } else if (normalizedHeader.includes('Тип упаковки') || headerLower.includes('package')) {
            mappedRow['Тип упаковки'] = row[idx];
          } else if (normalizedHeader.includes('Адрес магазина') || headerLower.includes('store address')) {
            mappedRow['Адрес магазина'] = row[idx];
          } else if (normalizedHeader.includes('Кол-во мест') || headerLower.includes('places count')) {
            mappedRow['Кол-во мест'] = row[idx];
          } else if (normalizedHeader.includes('Дата приема') || headerLower.includes('receipt date')) {
            mappedRow['Дата приема'] = row[idx];
          } else if (normalizedHeader === 'Вес' || headerLower === 'вес' || headerLower.includes('weight') || headerLower.includes('ağırlık') || headerLower.includes('重量')) {
            mappedRow['Вес'] = row[idx];
          } else if (normalizedHeader === 'Длина' || headerLower === 'длина' || headerLower.includes('length') || headerLower.includes('uzunluk') || headerLower.includes('长度')) {
            mappedRow['Длина'] = row[idx];
          } else if (normalizedHeader === 'Ширина' || headerLower === 'ширина' || headerLower.includes('width') || headerLower.includes('genişlik') || headerLower.includes('宽度')) {
            mappedRow['Ширина'] = row[idx];
          } else if (normalizedHeader === 'Высота' || headerLower === 'высота' || headerLower.includes('height') || headerLower.includes('yükseklik') || headerLower.includes('高度')) {
            mappedRow['Высота'] = row[idx];
          } else if (normalizedHeader === 'Объем' || headerLower === 'объем' || headerLower.includes('volume') || headerLower.includes('hacim') || headerLower.includes('体积')) {
            mappedRow['Объем'] = row[idx];
          } else if (normalizedHeader === 'С' || normalizedHeader === 'C' || normalizedHeader === '金额' || normalizedHeader.includes('стоимость') || headerLower.includes('cost') || headerLower.includes('shipping')) {
            mappedRow['С'] = row[idx];
          } else if (normalizedHeader.includes('Статус') || headerLower.includes('status')) {
            mappedRow['Статус'] = row[idx];
          } else if (normalizedHeader.includes('Расчётная дата') || normalizedHeader.includes('прибытия') || headerLower.includes('eta')) {
            mappedRow['Расчётная дата прибытия'] = row[idx];
          } else if (normalizedHeader.includes('Дата прибытия')) {
            mappedRow['Дата прибытия'] = row[idx];
          } else {
            mappedRow[normalizedHeader] = row[idx];
          }
        }
      });
      
      // Debug: log first 3 rows mapping
      if (i < dataStartIdx + 3) {
        console.log(`AbuSaxiy Row ${i} mapped:`, { 
          trackCode: mappedRow['Трек код'], 
          receipt: mappedRow['Номер приема'],
          weight: mappedRow['Вес'], 
          volume: mappedRow['Объем'], 
          cost: mappedRow['С'],
          length: mappedRow['Длина'],
          width: mappedRow['Ширина'],
          height: mappedRow['Высота']
        });
      }
      
      // Only add if has receipt number
      if (mappedRow['Номер приема'] || mappedRow['Номер магазина']) {
        // Use track code as receipt number if receipt is missing
        if (!mappedRow['Номер приема'] && mappedRow['Номер магазина']) {
          mappedRow['Номер приема'] = mappedRow['Номер магазина'];
        }
        rows.push(mappedRow);
      }
    }
    
    return { rows, reportType, rawText };
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setStage('preview');
    
    // Determine file type
    const isPDF = file.name.toLowerCase().endsWith('.pdf');
    const isExcel = file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls');
    setFileType(isPDF ? 'pdf' : 'excel');
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      let jsonData: any[] = [];
      let reportType: 'in_transit' | 'arrived' = 'in_transit';
      let fullText = '';
      
      if (isPDF) {
        // PDF parsing
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let allTableRows: string[][] = [];
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
          
          const items = textContent.items.map((item: any) => ({
            str: item.str,
            transform: item.transform
          }));
          
          const pageRows = parseTableRowsFromItems(items);
          allTableRows = [...allTableRows, ...pageRows];
        }
        
        console.log("DEBUG: Raw PDF Text ->", fullText);
        console.log("DEBUG: Parsed PDF Table Rows ->", allTableRows);
        
        const result = extractDataFromPDFText(fullText, allTableRows);
        console.log("DEBUG: Extracted Result ->", result.rows);
        
        jsonData = result.rows;
        reportType = result.reportType;
      } else if (isExcel) {
        // Excel parsing
        const result = await extractDataFromExcel(arrayBuffer);
        jsonData = result.rows;
        reportType = result.reportType;
        fullText = result.rawText;
      } else {
        toast({
          title: 'Xato',
          description: 'Faqat PDF yoki Excel fayllarni yuklash mumkin',
          variant: 'destructive',
        });
        setStage('upload');
        return;
      }
      
      setRawText(fullText);
      
      if (jsonData.length === 0) {
        toast({
          title: 'Ogohlantirish',
          description: `${isPDF ? 'PDF' : 'Excel'} fayldan ma'lumot topilmadi. Iltimos, to'g'ri formatdagi faylni yuklang.`,
          variant: 'destructive',
        });
        setStage('upload');
        return;
      }
      
      // Group rows by receipt number
      const shipmentGroups: Record<string, any[]> = {};
      
      for (const row of jsonData) {
        const rawReceiptNumber = row['Номер приема'];
        const receiptNumber = String(rawReceiptNumber || '').trim();
        if (receiptNumber && receiptNumber !== 'Итого' && receiptNumber !== '合计') {
          if (!shipmentGroups[receiptNumber]) {
            shipmentGroups[receiptNumber] = [];
          }
          shipmentGroups[receiptNumber].push(row);
        }
      }
      
      // Parse and validate data
      const parsedShipments: ParsedShipment[] = [];
      const warnings: string[] = [];
      let globalTotalWeight = 0;
      let globalTotalVolume = 0;
      let globalTotalCost = 0;
      const skippedTrackCodes: string[] = []; // Trek raqami topilmagan kodlar
      
      // YANGI: Avval barcha trek raqamlarni box_track_codes jadvalidan olish
      const { data: allTrackCodes } = await supabase
        .from('box_track_codes')
        .select('box_id, track_code');
      
      // ESKI: boxes jadvalidan ham qidirish (backward compatibility)
      const { data: allBoxesWithTrackCodes } = await supabase
        .from('boxes')
        .select('id, store_number, abusaxiy_receipt_number');
      
      // Trek raqamlar map'ini yaratish - box_track_codes dan (yangi tizim)
      // Mapped map to arrays of ids so we can greedily match distinct boxes
      const trackCodeToBoxIds = new Map<string, string[]>();
      allTrackCodes?.forEach(tc => {
        const code = String(tc.track_code).trim().toLowerCase();
        if (code) {
          const ids = trackCodeToBoxIds.get(code) || [];
          if (!ids.includes(tc.box_id)) ids.push(tc.box_id);
          trackCodeToBoxIds.set(code, ids);
        }
      });
      
      // Eski boxes jadvalidan ham qo'shish (backward compatibility)
      allBoxesWithTrackCodes?.forEach(box => {
        if (box.store_number) {
          const code = String(box.store_number).trim().toLowerCase();
          if (code) {
             const ids = trackCodeToBoxIds.get(code) || [];
             if (!ids.includes(box.id)) ids.push(box.id);
             trackCodeToBoxIds.set(code, ids);
          }
        }
        if (box.abusaxiy_receipt_number) {
          const code = String(box.abusaxiy_receipt_number).trim().toLowerCase();
          if (code) {
             const ids = trackCodeToBoxIds.get(code) || [];
             if (!ids.includes(box.id)) ids.push(box.id);
             trackCodeToBoxIds.set(code, ids);
          }
        }
      });

      // Track already assigned boxes during this import so we don't assign multiple rows to the same existing box
      const assignedExistingBoxIds = new Set<string>();

      // Aqlli (fuzzy) trek raqam moslashtirish funksiyasi
      const findFuzzyMatch = (pdfTrackCode: string): string | undefined => {
        const cleanPdf = pdfTrackCode.replace(/\s+/g, '').toLowerCase();
        if (!cleanPdf) return undefined;

        const getUnassigned = (ids: string[] | undefined) => {
          if (!ids) return undefined;
          return ids.find(id => !assignedExistingBoxIds.has(id));
        };

        // 1. Exact match
        const exact = getUnassigned(trackCodeToBoxIds.get(pdfTrackCode.toLowerCase()));
        if (exact) return exact;

        // 2. Probellarni olib tashlab moslashtirish
        for (const [sysCode, boxIds] of trackCodeToBoxIds) {
          const cleanSys = sysCode.replace(/\s+/g, '');
          if (cleanSys === cleanPdf) {
            const found = getUnassigned(boxIds);
            if (found) return found;
          }
        }

        // 3. Prefix matching (kamida 8 belgi mos kelsa)
        if (cleanPdf.length >= 8) {
          for (const [sysCode, boxIds] of trackCodeToBoxIds) {
            const cleanSys = sysCode.replace(/\s+/g, '');
            if (cleanSys.startsWith(cleanPdf) || cleanPdf.startsWith(cleanSys)) {
              const found = getUnassigned(boxIds);
              if (found) return found;
            }
          }
        }

        return undefined;
      };
      
      for (const [receiptNumber, rows] of Object.entries(shipmentGroups)) {
        // Check if shipment exists
        const { data: existingShipment } = await supabase
          .from('shipments')
          .select('id')
          .eq('shipment_number', receiptNumber)
          .maybeSingle();
        
        const firstRow = rows[0];
        const hasActualArrival = rows.some(r => r['Дата прибытия'] && r['Дата прибытия'] !== '');
        
        let status: string;
        if (hasActualArrival || reportType === 'arrived') {
          status = 'arrived';
        } else {
          status = 'in_transit';
        }
        
        const parsedBoxes: ParsedBox[] = [];
        let shipmentTotalWeight = 0;
        let shipmentTotalVolume = 0;
        let shipmentTotalCost = 0;
        
        // Qatorlarni xom shaklda yig'ish o'rniga, avval Trek Kod bo'yicha guruhlaymiz.
        // Agar trek kodi yo'q bo'lsa, uni alohida quti qilib saqlash uchun unikal ID berib ketamiz.
        const aggregatedRows = new Map<string, any>();
        let missingTrackCounter = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rawTrackCode = row['Трек код'] || row['Номер магазина'];
          let trackCode = rawTrackCode ? String(rawTrackCode).trim() : '';
          
          let groupKey = trackCode;
          if (!trackCode) {
            groupKey = `MISSING_TRACK_${missingTrackCounter++}`;
            const boxNumber = `${receiptNumber}-${row['Номер места'] || String(i + 1)}`;
            console.warn('Trek kod topilmadi:', { boxNumber, row });
            skippedTrackCodes.push(`${boxNumber} (trek kod yo'q)`);
          }

          let weight = parseNumber(row['Вес']) || 0;
          let vol = parseNumber(row['Объем']) || 0;
          let cost = parseNumber(row['С']) || 0;
          
          // Swap logic for tiny misplacements
          if (vol > 2 && cost > 0 && cost < 2) {
            [vol, cost] = [cost, vol];
          }

          if (aggregatedRows.has(groupKey)) {
             // Agregatsiya (summa qilish)
             const existingInfo = aggregatedRows.get(groupKey);
             existingInfo.weight += weight;
             existingInfo.vol += vol;
             existingInfo.cost += cost;
             // Biz o'rinlarni vergul bilan ajratib yozishimiz mumkin yoki sanashimiz mumkin
             existingInfo.places.push(row['Номер места'] || String(i + 1));
          } else {
             // Birinchi marta uchrashi
             aggregatedRows.set(groupKey, {
                originalRow: row,
                trackCode: trackCode,
                weight: weight,
                vol: vol,
                cost: cost,
                places: [row['Номер места'] || String(i + 1)]
             });
          }
        }

        // Endi guruhlangan (agregatsiya bo'lgan) ma'lumotlarni qutilarga aylantiramiz
        let finalPlaceIndex = 1;
        for (const [groupKey, aggData] of aggregatedRows.entries()) {
          const row = aggData.originalRow;
          const trackCode = aggData.trackCode;
          
          // Qutining o'rnini (placeNumber) 1 dan boshlab tartiblaymiz:
          const placeNumber = aggData.places.length > 1 ? aggData.places.join(',') : aggData.places[0];
          const boxNumber = `${receiptNumber}-${finalPlaceIndex++}`;
          
          // Izlashda yangilangan greedy matcherdan foydalanish
          const matchedBoxId = trackCode ? findFuzzyMatch(trackCode) : undefined;
          
          if (matchedBoxId) {
            assignedExistingBoxIds.add(matchedBoxId);
            
            shipmentTotalWeight += aggData.weight;
            shipmentTotalVolume += aggData.vol;
            shipmentTotalCost += aggData.cost;
            
            parsedBoxes.push({
              boxNumber: boxNumber,
              placeNumber: typeof placeNumber === 'string' && placeNumber.length > 20 ? placeNumber.substring(0,20) + '...' : String(placeNumber),
              productDescription: row['Наim. товара'] || null,
              packageType: row['Тип упаковки'] || 'Korobka',
              weightKg: parseFloat(aggData.weight.toFixed(2)) || null,
              lengthCm: parseNumber(row['Длина']),
              widthCm: parseNumber(row['Ширина']),
              heightCm: parseNumber(row['Высота']),
              volumeM3: parseFloat(aggData.vol.toFixed(4)) || null,
              shippingCost: parseFloat(aggData.cost.toFixed(2)) || null,
              storePhone: row['Тел. Магазина'] || null,
              storeNumber: trackCode || null,
              estimatedArrival: parseDate(row['Расчётная дата прибытия']),
              actualArrival: parseDate(row['Дата прибытия']),
              daysInTransit: parseNumber(row['Количество дней в пути']),
              status: hasActualArrival || reportType === 'arrived' ? 'arrived' : 'in_transit',
              location: hasActualArrival || reportType === 'arrived' ? 'uzbekistan' : 'transit',
              isExisting: true,
              existingBoxId: matchedBoxId,
            });
          } else if (trackCode) {
            if (!skippedTrackCodes.includes(trackCode)) {
               skippedTrackCodes.push(trackCode); 
            }
          }
        }
        
        // Faqat qutilari bor (ya'ni bazadan topilgan qutilari bor) jo'natmalarni qo'shish
        if (parsedBoxes.length > 0) {
          globalTotalWeight += shipmentTotalWeight;
          globalTotalVolume += shipmentTotalVolume;
          globalTotalCost += shipmentTotalCost;
          
          parsedShipments.push({
            receiptNumber,
            status,
            totalWeight: shipmentTotalWeight,
            totalVolume: shipmentTotalVolume,
            totalShippingCost: shipmentTotalCost,
            estimatedArrival: parseDate(firstRow['Расчётная дата прибытия'] || firstRow['Дата прибытия']),
            boxes: parsedBoxes,
            isExisting: !!existingShipment,
          });
        }
      }
      
      // Unique skipped track codes
      const uniqueSkippedCodes = [...new Set(skippedTrackCodes)];
      
      setParsedData(parsedShipments);
      setSummary({
        totalRows: jsonData.length,
        shipmentsToCreate: parsedShipments.filter(s => !s.isExisting).length,
        shipmentsToUpdate: parsedShipments.filter(s => s.isExisting).length,
        boxesNotFound: parsedShipments.flatMap(s => s.boxes).filter(b => !b.isExisting).length,
        boxesToUpdate: parsedShipments.flatMap(s => s.boxes).filter(b => b.isExisting).length,
        boxesToCreate: 0, // AbuSaxiy import hesh qachon yangi quti yaratmaydi (faqat topilganlar yangilanadi)
        totalWeight: globalTotalWeight,
        totalVolume: globalTotalVolume,
        totalShippingCost: globalTotalCost,
        reportType,
        warnings,
        skippedBoxes: uniqueSkippedCodes.length,
        skippedTrackCodes: uniqueSkippedCodes,
      });
      
    } catch (error: any) {
      console.error('Parse error:', error);
      toast({
        title: 'Xato',
        description: `Faylni o'qishda xatolik: ${error.message}`,
        variant: 'destructive',
      });
      setStage('upload');
    }
    
    event.target.value = '';
  }, [toast]);

  const handleImport = async () => {
    setStage('importing');
    setImportProgress(0);
    
    const { data: { user } } = await supabase.auth.getUser();
    const warnings: string[] = [];
    let success = 0;
    let failed = 0;
    let created = 0;
    
    const totalOperations = parsedData.length + parsedData.flatMap(s => s.boxes).length;
    let completed = 0;
    
    try {
      for (const shipment of parsedData) {
        let shipmentId: string;
        
        // Create or update shipment
        if (shipment.isExisting) {
          const { data: existing } = await supabase
            .from('shipments')
            .select('id')
            .eq('shipment_number', shipment.receiptNumber)
            .single();
          
          shipmentId = existing!.id;
          
          await supabase
            .from('shipments')
            .update({
              status: shipment.status,
              total_places: shipment.boxes.length,
              total_weight_kg: shipment.totalWeight,
              total_volume_m3: shipment.totalVolume,
              estimated_arrival: shipment.estimatedArrival,
            })
            .eq('id', shipmentId);
        } else {
          const { data: newShipment, error } = await supabase
            .from('shipments')
            .insert({
              shipment_number: shipment.receiptNumber,
              status: shipment.status,
              carrier: 'AbuSaxiy',
              total_places: shipment.boxes.length,
              total_weight_kg: shipment.totalWeight,
              total_volume_m3: shipment.totalVolume,
              estimated_arrival: shipment.estimatedArrival,
              created_by: user?.id,
            })
            .select('id')
            .single();
          
          if (error) {
            failed++;
            warnings.push(`Jo'natma yaratishda xato: ${shipment.receiptNumber}`);
            continue;
          }
          
          shipmentId = newShipment.id;
        }
        
        completed++;
        setImportProgress(Math.floor((completed / totalOperations) * 100));
        
        // Process boxes
        for (const box of shipment.boxes) {
          try {
            const boxData = {
              box_number: box.boxNumber,
              abusaxiy_receipt_number: shipment.receiptNumber,
              place_number: box.placeNumber,
              product_description: box.productDescription,
              package_type: box.packageType,
              weight_kg: box.weightKg,
              length_cm: box.lengthCm,
              width_cm: box.widthCm,
              height_cm: box.heightCm,
              volume_m3: box.volumeM3,
              shipping_cost: box.shippingCost,
              store_phone: box.storePhone,
              store_number: box.storeNumber,
              estimated_arrival: box.estimatedArrival,
              actual_arrival: box.actualArrival,
              days_in_transit: box.daysInTransit,
              status: box.status,
              location: box.location,
            };
            
            if (box.isExisting && box.existingBoxId) {
              // To'g'ridan-to'g'ri ID orqali yangilash (parsing bosqichida topilgan)
              const boxId = box.existingBoxId;
              
              // Update existing box with PDF data
              await supabase
                .from('boxes')
                .update(boxData)
                .eq('id', boxId);
              
              // Link to shipment if not already linked
              const { data: existingLink } = await supabase
                .from('shipment_boxes')
                .select('id')
                .eq('box_id', boxId)
                .eq('shipment_id', shipmentId)
                .maybeSingle();
              
              if (!existingLink) {
                await supabase.from('shipment_boxes').insert({
                  shipment_id: shipmentId,
                  box_id: boxId,
                });
              }
              
              // AUTO-DISTRIBUTE: Trek raqam orqali topilgan qutidagi mahsulotlarga yo'l haqqini avtomatik taqsimlash
              if (box.shippingCost && box.shippingCost > 0) {
                const { data: distResult, error: distError } = await supabase.rpc('auto_distribute_box_shipping_cost', {
                  p_box_id: boxId,
                  p_shipping_cost: box.shippingCost,
                  p_volume_m3: box.volumeM3 || 0,
                  p_usd_to_uzs: usdToUzs,
                } as any);
                
                if (distError) {
                  warnings.push(`Yo'l haqqi taqsimlanmadi: ${box.boxNumber} - ${distError.message}`);
                } else if (distResult && typeof distResult === 'object' && 'updated' in distResult && (distResult as { updated: number }).updated > 0) {
                  const result = distResult as { updated: number; method?: string };
                  const methodLabel = result.method === 'by_weight' ? 'og\'irlik bo\'yicha' : 'teng';
                  warnings.push(`✅ ${box.boxNumber}: ${result.updated} ta mahsulotga yo'l haqqi taqsimlandi ($${box.shippingCost}, ${methodLabel}) — tannarxga so'mda qo'shildi`);
                }
              }
              
              success++;
            } else {
              // Parsing bosqichida topilmagan qutilarni (isExisting=false) 
              // import qilmaymiz, chunki ularning bazada haqiqiy "qutisi" yoq.
              // Biz ularni yomon xato deb emas, balki "Bu normal, faqat topilganlar import qilinadi" deymiz 
              // shuning uchun failed++ yozmaymiz, xatoga ham (warningga ham) yozmaymiz.
            }
          } catch (error: any) {
            failed++;
            warnings.push(`Quti xatosi: ${box.boxNumber} - ${error.message}`);
          }
          
          completed++;
          setImportProgress(Math.floor((completed / totalOperations) * 100));
        }
      }
      
      // Log import
      await supabase.from('excel_import_logs').insert({
        file_name: fileName,
        rows_processed: summary?.totalRows || 0,
        rows_success: success,
        rows_failed: failed,
        errors: warnings.length > 0 ? { warnings } : null,
        imported_by: user?.id,
      });
      
      setImportResults({ success, failed, created, warnings });
      setStage('complete');
      
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      
    } catch (error: any) {
      toast({
        title: 'Import xatosi',
        description: error.message,
        variant: 'destructive',
      });
      setStage('preview');
    }
  };

  const handleClose = () => {
    setStage('upload');
    setParsedData([]);
    setSummary(null);
    setImportProgress(0);
    setImportResults(null);
    setFileName('');
    setRawText('');
    setFileType('pdf');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-3xl w-[95vw] sm:w-[95vw] max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            AbuSaxiy Import (PDF / Excel)
          </DialogTitle>
        </DialogHeader>
        
        {stage === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">{t('pdf_select_file')}</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              {t('pdf_import_hint')}
            </p>
            <input
              type="file"
              accept=".pdf,.xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="pdf-import-file"
            />
            <Button 
              className="gap-2 bg-gradient-to-r from-primary to-secondary shadow-lg"
              onClick={() => document.getElementById('pdf-import-file')?.click()}
            >
              <Upload className="h-4 w-4" />
              Fayl tanlash (PDF / Excel)
            </Button>
            <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>.pdf</span>
              </div>
              <div className="flex items-center gap-1">
                <FileSpreadsheet className="h-3 w-3" />
                <span>.xlsx, .xls</span>
              </div>
            </div>
          </div>
        )}
        
        {stage === 'preview' && summary && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Report Type Banner */}
            <div className={`p-3 rounded-lg mb-4 flex items-center gap-3 ${
              summary.reportType === 'arrived' 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
              {summary.reportType === 'arrived' ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-green-500">Kelgan tovarlar hisoboti</span>
                </>
              ) : (
                <>
                  <Ship className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium text-blue-500">Yo'lda tovarlar hisoboti</span>
                </>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                {fileType === 'excel' ? <FileSpreadsheet className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                {fileName}
              </span>
            </div>
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-foreground">{summary.shipmentsToCreate + summary.shipmentsToUpdate}</div>
                <div className="text-xs text-muted-foreground">Jo'natmalar</div>
              </div>
             <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-foreground">{summary.boxesToUpdate}</div>
                <div className="text-xs text-muted-foreground">{summary.boxesToUpdate} topildi / {summary.skippedBoxes || 0} topilmadi</div>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-foreground">{summary.totalWeight.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Jami kg</div>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-foreground">${summary.totalShippingCost.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">Jami narx</div>
              </div>
            </div>
            
            {/* Action breakdown */}
            <div className="space-y-2 mb-4">
              {summary.shipmentsToCreate > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Plus className="h-4 w-4 text-green-500" />
                  <span>{summary.shipmentsToCreate} ta yangi jo'natma yaratiladi</span>
                </div>
              )}
              {summary.shipmentsToUpdate > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-blue-500" />
                  <span>{summary.shipmentsToUpdate} ta jo'natma yangilanadi</span>
                </div>
              )}
              {summary.boxesToCreate > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-green-500" />
                  <span>{summary.boxesToCreate} ta yangi quti yaratiladi</span>
                </div>
              )}
              {summary.boxesToUpdate > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-blue-500" />
                  <span>{summary.boxesToUpdate} ta quti yangilanadi</span>
                </div>
              )}
            </div>
            
            {/* Skipped boxes note */}
            {summary.skippedBoxes > 0 && (
              <p className="text-xs text-muted-foreground mb-4">
                ℹ️ {summary.skippedBoxes} ta trek raqam tizimda topilmadi (bu normal — faqat topilganlar import qilinadi)
              </p>
            )}
            
            {/* Warnings */}
            {summary.warnings.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-yellow-500 font-medium text-sm mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Ogohlantirishlar
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {summary.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                  {summary.warnings.length > 5 && (
                    <li>... va yana {summary.warnings.length - 5} ta</li>
                  )}
                </ul>
              </div>
            )}
            
            {/* Data Preview */}
            <Tabs defaultValue="boxes" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="shipments" className="gap-1">
                  <Ship className="h-3 w-3" />
                  <span className="hidden sm:inline">Jo'natmalar</span> ({parsedData.length})
                </TabsTrigger>
                <TabsTrigger value="boxes" className="gap-1">
                  <Package className="h-3 w-3" />
                  <span className="hidden sm:inline">Qutilar</span> ({parsedData.flatMap(s => s.boxes).length})
                </TabsTrigger>
                <TabsTrigger value="raw" className="gap-1">
                  <FileText className="h-3 w-3" />
                  <span className="hidden sm:inline">Xom ma'lumot</span>
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="shipments" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2 pr-4">
                    {parsedData.map((shipment, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 bg-muted rounded-lg text-sm">
                        <Badge variant={shipment.isExisting ? 'secondary' : 'default'} className="text-xs">
                          {shipment.isExisting ? 'Yangilanadi' : 'Yaratiladi'}
                        </Badge>
                        <span className="font-medium">{shipment.receiptNumber}</span>
                        <span className="text-muted-foreground">{shipment.boxes.length} quti</span>
                        <span className="text-muted-foreground ml-auto">{shipment.totalWeight.toFixed(1)} kg</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="boxes" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2 pr-4">
                    {(() => {
                      const allBoxes = parsedData.flatMap(s => s.boxes);
                      const matched = allBoxes.filter(b => b.isExisting);
                      const unmatched = allBoxes.filter(b => !b.isExisting);
                      return (
                        <>
                          {matched.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-green-600 mb-1">✅ Topilgan qutilar ({matched.length})</p>
                              {matched.map((box, idx) => (
                                <div key={`m-${idx}`} className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-sm space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground">{box.boxNumber}</span>
                                    <Badge variant="secondary" className="text-xs">Yangilanadi</Badge>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Package className="h-3 w-3" />
                                    <span>Trek: {box.storeNumber || '-'}</span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                                    <div className="flex items-center gap-1">
                                      <Scale className="h-3 w-3 text-blue-500" />
                                      <span>{box.weightKg?.toFixed(1) || '-'} kg</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Package className="h-3 w-3 text-purple-500" />
                                      <span>{box.volumeM3?.toFixed(3) || '-'} m³</span>
                                    </div>
                                    <div className="flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                                      <DollarSign className="h-3 w-3" />
                                      <span>${box.shippingCost?.toFixed(2) || '0.00'}</span>
                                    </div>
                                  </div>
                                  {box.productDescription && (
                                    <p className="text-xs text-muted-foreground truncate">{box.productDescription}</p>
                                  )}
                                </div>
                              ))}
                            </>
                          )}
                          {unmatched.length > 0 && (
                            <>
                              <p className="text-xs font-medium text-amber-600 mt-2 mb-1">⚠️ Topilmagan trek kodlar ({unmatched.length})</p>
                              {unmatched.map((box, idx) => (
                                <div key={`u-${idx}`} className="flex items-center gap-3 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                                  <span className="font-medium">{box.boxNumber}</span>
                                  <span className="text-muted-foreground text-xs truncate">{box.storeNumber || '-'}</span>
                                  <span className="text-muted-foreground ml-auto">{box.weightKg?.toFixed(1) || '-'} kg</span>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="raw" className="flex-1 overflow-hidden mt-2">
                <ScrollArea className="h-[200px]">
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap p-2 bg-muted rounded-lg">
                    {rawText || 'Ma\'lumot topilmadi'}
                  </pre>
                </ScrollArea>
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-4 gap-2">
              <Button variant="outline" onClick={handleClose}>
                Bekor qilish
              </Button>
              <Button 
                onClick={handleImport}
                className="gap-2 bg-gradient-to-r from-primary to-secondary"
                disabled={parsedData.length === 0}
              >
                <Upload className="h-4 w-4" />
                Import qilish ({parsedData.flatMap(s => s.boxes).filter(b => b.isExisting).length} qutiga yo'l haqqi)
              </Button>
            </DialogFooter>
          </div>
        )}
        
        {stage === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-full max-w-md space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-medium text-foreground mb-2">Import jarayonida...</h3>
                <p className="text-sm text-muted-foreground">Ma'lumotlar bazaga yuklanmoqda</p>
              </div>
              <Progress value={importProgress} className="h-2" />
              <p className="text-center text-sm text-muted-foreground">{importProgress}%</p>
            </div>
          </div>
        )}
        
        {stage === 'complete' && importResults && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Import yakunlandi!</h3>
            
            <div className="grid grid-cols-3 gap-4 mt-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{importResults.success}</div>
                <div className="text-xs text-muted-foreground">Muvaffaqiyatli</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">{importResults.created}</div>
                <div className="text-xs text-muted-foreground">Yaratildi</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{importResults.failed}</div>
                <div className="text-xs text-muted-foreground">Xato</div>
              </div>
            </div>
            
            {importResults.warnings.length > 0 && (
              <ScrollArea className="max-h-[100px] w-full mb-4">
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {importResults.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              </ScrollArea>
            )}
            
            <Button onClick={handleClose} className="gap-2">
              <Check className="h-4 w-4" />
              Yopish
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
