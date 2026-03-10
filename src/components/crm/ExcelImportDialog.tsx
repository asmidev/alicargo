import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Upload, FileSpreadsheet, Check, 
  Package, Ship, ChevronRight, Scale, DollarSign, AlertTriangle, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

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
  trackCode: string | null;
  estimatedArrival: string | null;
  actualArrival: string | null;
  daysInTransit: number | null;
  status: string;
  location: string;
  isExisting: boolean;
  trackCodeNotFound: boolean;
  foundByTrackCode: boolean;
  resolvedBoxId: string | null;
  weightMismatch: string | null;
  weightMatchQuality: 'exact' | 'approximate' | 'large_diff' | null;
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
  trackCodesNotFound: { trackCode: string; weight: number | null; placeNumber: string }[];
}

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Ko'p tilli sarlavha mapping
const HEADER_MAP: Record<string, string[]> = {
  receiptNumber: ['Номер приема', '接收编号', 'Qabul raqami', 'Receipt Number', 'shipment_number'],
  placeNumber: ['Номер места', '位置编号', 'Joy raqami', 'Place Number'],
  trackCode: ['Трек код', 'Трек Код', 'трек код', '跟踪代码', 'Trek kod', 'Track Code'],
  weight: ['Вес', '重量', "Og'irlik", 'Weight'],
  volume: ['Объем', '体积', 'Hajm', 'Volume'],
  shippingCost: ['С', '费用', 'Narx', 'Shipping Cost', 'Cost'],
  productDescription: ['Наим. товара', '商品名称', 'Tovar nomi', 'Product'],
  packageType: ['Тип упаковки', '包装类型', 'Qadoq turi', 'Package Type'],
  length: ['Длина', '长度', 'Uzunlik', 'Length'],
  width: ['Ширина', '宽度', 'Kenglik', 'Width'],
  height: ['Высота', '高度', 'Balandlik', 'Height'],
  storePhone: ['Тел. Магазина', '商店电话', "Do'kon telefoni", 'Store Phone'],
  storeNumber: ['Номер магазина', '商店编号', "Do'kon raqami", 'Store Number'],
  estimatedArrival: ['Расчётная дата прибытия', '预计到达日期', 'Taxminiy kelish sanasi'],
  actualArrival: ['Дата прибытия', '到达日期', 'Kelish sanasi'],
  daysInTransit: ['Количество дней в пути', '运输天数', "Yo'ldagi kunlar"],
  status: ['Статус', '状态', 'Holat', 'Status'],
};

// Qatordagi qiymatni ko'p tilli sarlavhadan o'qish
function getField(row: any, fieldName: string): any {
  const headers = HEADER_MAP[fieldName];
  if (!headers) return undefined;
  for (const h of headers) {
    if (row[h] !== undefined && row[h] !== null && row[h] !== '') return row[h];
  }
  return undefined;
}

// Итого/合计 qatorini aniqlash
const SKIP_KEYWORDS = ['Итого', '合计', 'Jami', 'Total', 'ИТОГО'];
function isSummaryRow(receiptNumber: any): boolean {
  if (!receiptNumber) return true;
  const str = String(receiptNumber);
  return SKIP_KEYWORDS.some(kw => str.includes(kw));
}

export function ExcelImportDialog({ open, onOpenChange }: ExcelImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [stage, setStage] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
  const [parsedData, setParsedData] = useState<ParsedShipment[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; created: number; warnings: string[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [showNotFoundList, setShowNotFoundList] = useState(false);
  
  
  const parseDate = (dateStr: string | number): string | null => {
    if (!dateStr) return null;
    if (typeof dateStr === 'number') {
      const date = new Date((dateStr - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof dateStr === 'string' && dateStr.includes('.')) {
      const [day, month, year] = dateStr.split('.');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return dateStr;
  };

  const parseNumber = (value: string | number): number | null => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'number') return value;
    return parseFloat(String(value).replace(',', '.')) || null;
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setFileName(file.name);
    setStage('preview');
    
    try {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          
          // Group rows by receipt number (ko'p tilli)
          const shipmentGroups: Record<string, any[]> = {};
          
          for (const row of jsonData as any[]) {
            const receiptNumber = getField(row, 'receiptNumber');
            if (receiptNumber && !isSummaryRow(receiptNumber)) {
              const key = String(receiptNumber).trim();
              if (!shipmentGroups[key]) {
                shipmentGroups[key] = [];
              }
              shipmentGroups[key].push(row);
            }
          }
          
          // Parse and validate data
          const parsedShipments: ParsedShipment[] = [];
          const warnings: string[] = [];
          const trackCodesNotFound: { trackCode: string; weight: number | null; placeNumber: string }[] = [];
          let globalTotalWeight = 0;
          let globalTotalVolume = 0;
          let globalTotalCost = 0;
          let reportType: 'in_transit' | 'arrived' = 'in_transit';
          
          for (const [receiptNumber, rows] of Object.entries(shipmentGroups)) {
            // Check if shipment exists
            const { data: existingShipment } = await supabase
              .from('shipments')
              .select('id')
              .eq('shipment_number', receiptNumber)
              .maybeSingle();
            
            const firstRow = rows[0];
            const hasActualArrival = rows.some(r => {
              const arrival = getField(r, 'actualArrival');
              return arrival && arrival !== '';
            });
            const statusRu = getField(firstRow, 'status') || '';
            
            let status: string;
            if (hasActualArrival) {
              status = 'arrived';
              reportType = 'arrived';
            } else if (statusRu === 'В пути') {
              status = 'in_transit';
            } else if (statusRu === 'Доставлено') {
              status = 'arrived';
              reportType = 'arrived';
            } else {
              status = 'pending';
            }
            
            const totalWeight = rows.reduce((sum, r) => sum + (parseNumber(getField(r, 'weight')) || 0), 0);
            const totalVolume = rows.reduce((sum, r) => sum + (parseNumber(getField(r, 'volume')) || 0), 0);
            const totalShippingCost = rows.reduce((sum, r) => sum + (parseNumber(getField(r, 'shippingCost')) || 0), 0);
            
            globalTotalWeight += totalWeight;
            globalTotalVolume += totalVolume;
            globalTotalCost += totalShippingCost;
            
            // === 1-BOSQICH: Barcha trek kodlarni yig'ish va batch fetch ===
            const allTrackCodes: string[] = [];
            const rowsWithData = rows.map(row => {
              const rawTrackCode = getField(row, 'trackCode');
              const trackCode = rawTrackCode ? String(rawTrackCode).trim() : null;
              if (trackCode && !allTrackCodes.includes(trackCode)) {
                allTrackCodes.push(trackCode);
              }
              return { row, trackCode, weight: parseNumber(getField(row, 'weight')) };
            });

            // Barcha trek kodlar uchun qutilarni BITTA so'rov bilan olish
            const trackCodeBoxesMap: Record<string, { id: string; weight_kg: number | null; box_number: string }[]> = {};
            if (allTrackCodes.length > 0) {
              const { data: allTrackCodeRecords } = await supabase
                .from('box_track_codes')
                .select('box_id, track_code')
                .in('track_code', allTrackCodes);

              if (allTrackCodeRecords && allTrackCodeRecords.length > 0) {
                const allBoxIds = [...new Set(allTrackCodeRecords.map(r => r.box_id))];
                const { data: allBoxes } = await supabase
                  .from('boxes')
                  .select('id, weight_kg, box_number')
                  .in('id', allBoxIds);

                // Trek kod bo'yicha qutilarni guruhlash
                for (const tc of allTrackCodes) {
                  const boxIdsForTC = allTrackCodeRecords
                    .filter(r => r.track_code === tc)
                    .map(r => r.box_id);
                  trackCodeBoxesMap[tc] = (allBoxes || []).filter(b => boxIdsForTC.includes(b.id));
                }
              }
            }

            // === 2-BOSQICH: Greedy weight matching ===
            // Trek kodlar bo'yicha Excel qatorlarini guruhlash
            const trackCodeGroups: Record<string, typeof rowsWithData> = {};
            const noTrackCodeRows: typeof rowsWithData = [];
            for (const rd of rowsWithData) {
              if (rd.trackCode) {
                if (!trackCodeGroups[rd.trackCode]) trackCodeGroups[rd.trackCode] = [];
                trackCodeGroups[rd.trackCode].push(rd);
              } else {
                noTrackCodeRows.push(rd);
              }
            }

            // Greedy matching natijalarini saqlash: row index -> match result
            const usedBoxIds = new Set<string>();
            const matchResults = new Map<any, {
              existingBoxId: string | null;
              foundByTrackCode: boolean;
              trackCodeNotFound: boolean;
              weightMismatch: string | null;
              weightMatchQuality: 'exact' | 'approximate' | 'large_diff' | null;
            }>();

            // Har bir trek kod guruhi uchun greedy matching
            for (const [tc, tcRows] of Object.entries(trackCodeGroups)) {
              const availableBoxes = (trackCodeBoxesMap[tc] || []).filter(b => !usedBoxIds.has(b.id));

              if (availableBoxes.length === 0) {
                // Trek kod tizimda topilmadi
                for (const rd of tcRows) {
                  matchResults.set(rd.row, {
                    existingBoxId: null,
                    foundByTrackCode: false,
                    trackCodeNotFound: true,
                    weightMismatch: null,
                    weightMatchQuality: null,
                  });
                  trackCodesNotFound.push({
                    trackCode: tc,
                    weight: rd.weight,
                    placeNumber: String(getField(rd.row, 'placeNumber') || ''),
                  });
                }
                continue;
              }

              // Barcha juftliklar uchun og'irlik farqini hisoblash
              const pairs: { rowData: typeof tcRows[0]; box: typeof availableBoxes[0]; diff: number }[] = [];
              for (const rd of tcRows) {
                for (const box of availableBoxes) {
                  const diff = Math.abs((rd.weight || 0) - (box.weight_kg || 0));
                  pairs.push({ rowData: rd, box, diff });
                }
              }

              // Eng kichik farqdan boshlab juftlash
              pairs.sort((a, b) => a.diff - b.diff);
              const assignedRows = new Set<any>();
              const assignedBoxes = new Set<string>();

              for (const pair of pairs) {
                if (assignedRows.has(pair.rowData.row) || assignedBoxes.has(pair.box.id)) continue;

                assignedRows.add(pair.rowData.row);
                assignedBoxes.add(pair.box.id);
                usedBoxIds.add(pair.box.id);

                let weightMismatch: string | null = null;
                let weightMatchQuality: 'exact' | 'approximate' | 'large_diff' | null = null;
                if (pair.rowData.weight != null && pair.box.weight_kg != null) {
                  if (pair.diff <= 0.5) {
                    weightMatchQuality = 'exact';
                  } else if (pair.diff <= 2) {
                    weightMatchQuality = 'approximate';
                    weightMismatch = `Excel=${pair.rowData.weight.toFixed(2)}kg, Tizim=${pair.box.weight_kg.toFixed(2)}kg`;
                  } else {
                    weightMatchQuality = 'large_diff';
                    weightMismatch = `Excel=${pair.rowData.weight.toFixed(2)}kg, Tizim=${pair.box.weight_kg.toFixed(2)}kg`;
                  }
                }

                matchResults.set(pair.rowData.row, {
                  existingBoxId: pair.box.id,
                  foundByTrackCode: true,
                  trackCodeNotFound: false,
                  weightMismatch,
                  weightMatchQuality,
                });
              }

              // Qolgan juftlanmagan qatorlar (qutilar yetarli emas)
              for (const rd of tcRows) {
                if (!assignedRows.has(rd.row)) {
                  matchResults.set(rd.row, {
                    existingBoxId: null,
                    foundByTrackCode: false,
                    trackCodeNotFound: true,
                    weightMismatch: null,
                    weightMatchQuality: null,
                  });
                  trackCodesNotFound.push({
                    trackCode: tc,
                    weight: rd.weight,
                    placeNumber: String(getField(rd.row, 'placeNumber') || ''),
                  });
                }
              }
            }

            // Trek kodsiz qatorlar uchun box_number bo'yicha qidirish
            for (const rd of noTrackCodeRows) {
              matchResults.set(rd.row, {
                existingBoxId: null,
                foundByTrackCode: false,
                trackCodeNotFound: false,
                weightMismatch: null,
                weightMatchQuality: null,
              });
            }

            // === ParsedBox yaratish ===
            const parsedBoxes: ParsedBox[] = [];
            
            for (const rd of rowsWithData) {
              const placeNumber = getField(rd.row, 'placeNumber') || '';
              const boxNumber = `${receiptNumber}-${placeNumber}`;
              const excelWeightKg = rd.weight;

              const match = matchResults.get(rd.row);
              let existingBoxId = match?.existingBoxId || null;
              let trackCodeNotFound = match?.trackCodeNotFound || false;
              let foundByTrackCode = match?.foundByTrackCode || false;
              let weightMismatch = match?.weightMismatch || null;
              let weightMatchQuality = match?.weightMatchQuality || null;

              // Agar trek kod orqali topilmagan bo'lsa, box_number bo'yicha qidirish
              if (!existingBoxId && !trackCodeNotFound) {
                const { data: byBoxNum } = await supabase
                  .from('boxes')
                  .select('id, weight_kg')
                  .eq('box_number', boxNumber)
                  .maybeSingle();

                if (byBoxNum) {
                  existingBoxId = byBoxNum.id;
                  if (excelWeightKg && byBoxNum.weight_kg) {
                    const diff = Math.abs(excelWeightKg - byBoxNum.weight_kg);
                    if (diff <= 0.5) {
                      weightMatchQuality = 'exact';
                    } else if (diff <= 2) {
                      weightMatchQuality = 'approximate';
                      weightMismatch = `Excel=${excelWeightKg.toFixed(2)}kg, Tizim=${byBoxNum.weight_kg.toFixed(2)}kg`;
                    } else {
                      weightMatchQuality = 'large_diff';
                      weightMismatch = `Excel=${excelWeightKg.toFixed(2)}kg, Tizim=${byBoxNum.weight_kg.toFixed(2)}kg`;
                    }
                  }
                }
              }

              parsedBoxes.push({
                boxNumber,
                placeNumber: String(placeNumber),
                productDescription: getField(rd.row, 'productDescription') || null,
                packageType: getField(rd.row, 'packageType') || 'Korobka',
                weightKg: excelWeightKg,
                lengthCm: parseNumber(getField(rd.row, 'length')),
                widthCm: parseNumber(getField(rd.row, 'width')),
                heightCm: parseNumber(getField(rd.row, 'height')),
                volumeM3: parseNumber(getField(rd.row, 'volume')),
                shippingCost: parseNumber(getField(rd.row, 'shippingCost')),
                storePhone: getField(rd.row, 'storePhone') || null,
                storeNumber: getField(rd.row, 'storeNumber') || null,
                trackCode: rd.trackCode,
                estimatedArrival: parseDate(getField(rd.row, 'estimatedArrival')),
                actualArrival: parseDate(getField(rd.row, 'actualArrival')),
                daysInTransit: parseNumber(getField(rd.row, 'daysInTransit')),
                status: hasActualArrival ? 'arrived' : (status === 'in_transit' ? 'in_transit' : 'packing'),
                location: hasActualArrival ? 'uzbekistan' : 'transit',
                isExisting: !!existingBoxId,
                trackCodeNotFound,
                foundByTrackCode,
                resolvedBoxId: existingBoxId,
                weightMismatch,
                weightMatchQuality,
              });
            }
            
            parsedShipments.push({
              receiptNumber,
              status,
              totalWeight,
              totalVolume,
              totalShippingCost,
              estimatedArrival: parseDate(getField(firstRow, 'estimatedArrival') || getField(firstRow, 'actualArrival')),
              boxes: parsedBoxes,
              isExisting: !!existingShipment,
            });
          }
          
          // Add warnings for boxes not found in the system
          const boxesNotFound = parsedShipments.flatMap(s => s.boxes).filter(b => !b.isExisting);
          
          if (trackCodesNotFound.length > 0) {
            warnings.push(`${trackCodesNotFound.length} ta trek kod tizimda topilmadi — yangi quti sifatida yaratiladi`);
          }
          
          setParsedData(parsedShipments);
          setSummary({
            totalRows: jsonData.length,
            shipmentsToCreate: parsedShipments.filter(s => !s.isExisting).length,
            shipmentsToUpdate: parsedShipments.filter(s => s.isExisting).length,
            boxesNotFound: boxesNotFound.length,
            boxesToUpdate: parsedShipments.flatMap(s => s.boxes).filter(b => b.isExisting).length,
            boxesToCreate: boxesNotFound.length,
            totalWeight: globalTotalWeight,
            totalVolume: globalTotalVolume,
            totalShippingCost: globalTotalCost,
            reportType,
            warnings,
            trackCodesNotFound,
          });
          
        } catch (error: any) {
          console.error('Parse error:', error);
          toast({
            title: 'Xato',
            description: 'Excel faylni o\'qishda xatolik: ' + error.message,
            variant: 'destructive',
          });
          setStage('upload');
        }
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      toast({
        title: 'Xato',
        description: error.message,
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

            
            if (box.isExisting) {
              // Trek kod orqali topilgan quti — id bo'yicha yangilash
              let updatedBoxId: string | null = box.resolvedBoxId;

              if (box.foundByTrackCode && box.resolvedBoxId) {
                const { data: updatedBox } = await supabase
                  .from('boxes')
                  .update(boxData)
                  .eq('id', box.resolvedBoxId)
                  .select('id')
                  .single();
                updatedBoxId = updatedBox?.id || null;
              } else {
                const { data: updatedBox } = await supabase
                  .from('boxes')
                  .update(boxData)
                  .eq('box_number', box.boxNumber)
                  .select('id')
                  .single();
                updatedBoxId = updatedBox?.id || null;
              }

              // Trek kodni mavjud qutiga upsert qilish
              if (updatedBoxId && box.trackCode) {
                const { data: existingTC } = await supabase
                  .from('box_track_codes')
                  .select('id')
                  .eq('box_id', updatedBoxId)
                  .eq('track_code', box.trackCode)
                  .maybeSingle();
                if (!existingTC) {
                  await supabase.from('box_track_codes').insert({
                    box_id: updatedBoxId,
                    track_code: box.trackCode,
                    source: 'excel_import',
                    is_primary: false,
                  });
                }
              }

              // Og'irlik bo'yicha yol haqqi taqsimlash
              if (updatedBoxId && box.shippingCost && box.shippingCost > 0) {
                await supabase.rpc('distribute_shipping_by_weight', {
                  p_box_ids: [updatedBoxId],
                  p_total_shipping_cost: box.shippingCost,
                });
              }
              
              success++;
            } else {
              // Trek raqam topilmadi — baribir yangi quti yaratish
              const finalBoxData = {
                ...boxData,
                store_number: box.trackCode || boxData.store_number,
              };
              const { data: newBox, error: boxError } = await supabase
                .from('boxes')
                .insert(finalBoxData)
                .select('id')
                .single();
              
              if (boxError) {
                failed++;
                warnings.push(`Quti yaratishda xato: ${box.boxNumber} - ${boxError.message}`);
              } else {
                await supabase.from('shipment_boxes').insert({
                  shipment_id: shipmentId,
                  box_id: newBox.id,
                });

                if (box.trackCode) {
                  await supabase.from('box_track_codes').insert({
                    box_id: newBox.id,
                    track_code: box.trackCode,
                    source: 'excel_import',
                    is_primary: true,
                  });
                }

                if (box.shippingCost && box.shippingCost > 0) {
                  await supabase.rpc('distribute_shipping_by_weight', {
                    p_box_ids: [newBox.id],
                    p_total_shipping_cost: box.shippingCost,
                  });
                }

                created++;
                success++;
              }
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
    setShowNotFoundList(false);
    onOpenChange(false);
  };

  // Weight match quality badge
  const getWeightBadge = (box: ParsedBox) => {
    if (!box.weightMatchQuality) return null;
    if (box.weightMatchQuality === 'exact') {
      return <Badge className="text-xs bg-green-500/20 text-green-600 border-green-500/30">✅ Aniq mos</Badge>;
    }
    if (box.weightMatchQuality === 'approximate') {
      return <Badge className="text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30">⚖️ Taxminiy mos</Badge>;
    }
    return <Badge className="text-xs bg-red-500/20 text-red-600 border-red-500/30">⚠️ Katta farq</Badge>;
  };

  // Badge rendering helper
  const getBoxBadge = (box: ParsedBox) => {
    if (box.foundByTrackCode) {
      return <Badge className="text-xs bg-blue-500/20 text-blue-600 border-blue-500/30 hover:bg-blue-500/30">🔗 Trek orqali topildi</Badge>;
    }
    if (box.isExisting && !box.foundByTrackCode) {
      return <Badge className="text-xs bg-blue-500/20 text-blue-600 border-blue-500/30 hover:bg-blue-500/30">📦 Box # topildi</Badge>;
    }
    if (box.trackCodeNotFound) {
      return <Badge className="text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/30">⚠️ Trek topilmadi</Badge>;
    }
    return <Badge className="text-xs bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30">+ Yangi</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-3xl w-[95vw] sm:w-[95vw] max-h-[100dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            AbuSaxiy Excel Import
          </DialogTitle>
        </DialogHeader>
        
        {stage === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Excel faylni tanlang</h3>
            <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
              AbuSaxiy Telegram botidan olingan "Yo'lda tovarlar" yoki "Kelgan tovarlar" hisobotini yuklang. 
              Tizim qutilar va jo'natmalarni avtomatik yaratadi.
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              id="excel-import-file"
            />
            <Button 
              className="gap-2 bg-gradient-to-r from-primary to-secondary shadow-lg"
              onClick={() => document.getElementById('excel-import-file')?.click()}
            >
              <Upload className="h-4 w-4" />
              Fayl tanlash
            </Button>
          </div>
        )}
        
        {stage === 'preview' && summary && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Report Type Banner */}
            <div className={`p-3 rounded-lg mb-3 flex items-center gap-3 ${
              summary.reportType === 'arrived' 
                ? 'bg-green-500/10 border border-green-500/20' 
                : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
              {summary.reportType === 'arrived' ? (
                <>
                  <Check className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-green-600 dark:text-green-400">Kelgan tovarlar hisoboti</p>
                    <p className="text-xs text-muted-foreground">Qutilar "yetib keldi" holati bilan yaratiladi</p>
                  </div>
                </>
              ) : (
                <>
                  <Ship className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium text-blue-600 dark:text-blue-400">Yo'lda tovarlar hisoboti</p>
                    <p className="text-xs text-muted-foreground">Qutilar "yo'lda" holati bilan yaratiladi</p>
                  </div>
                </>
              )}
            </div>

            {/* Trek kod topilmagan ogohlantirish */}
            {summary.trackCodesNotFound.length > 0 && (
              <Collapsible open={showNotFoundList} onOpenChange={setShowNotFoundList}>
                <Alert className="mb-3 border-yellow-500/30 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-yellow-700 dark:text-yellow-400 text-sm">
                      <strong>{summary.trackCodesNotFound.length}</strong> ta trek kod tizimda topilmadi — yangi quti sifatida yaratiladi
                    </span>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-yellow-600">
                        <ChevronDown className={`h-4 w-4 transition-transform ${showNotFoundList ? 'rotate-180' : ''}`} />
                      </Button>
                    </CollapsibleTrigger>
                  </AlertDescription>
                </Alert>
                <CollapsibleContent>
                  <div className="mb-3 p-2 bg-yellow-500/5 rounded-lg border border-yellow-500/20 max-h-32 overflow-y-auto">
                    <div className="space-y-1">
                      {summary.trackCodesNotFound.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs px-2 py-1 bg-yellow-500/10 rounded">
                          <span className="font-mono text-yellow-700 dark:text-yellow-300">🏷️ {item.trackCode}</span>
                          <div className="flex gap-3 text-muted-foreground">
                            <span>Joy: {item.placeNumber}</span>
                            {item.weight && <span>{item.weight.toFixed(2)} kg</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
            
            {/* Summary Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-foreground">{summary.shipmentsToCreate + summary.shipmentsToUpdate}</div>
                <div className="text-xs text-muted-foreground">Jo'natmalar</div>
                <div className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-500">+{summary.shipmentsToCreate}</span>
                  {summary.shipmentsToUpdate > 0 && <> / <span className="text-blue-500">~{summary.shipmentsToUpdate}</span></>}
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold text-foreground">{summary.boxesNotFound + summary.boxesToUpdate}</div>
                <div className="text-xs text-muted-foreground">Qutilar</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summary.boxesToUpdate > 0 && <span className="text-blue-500">~{summary.boxesToUpdate} yangilanadi</span>}
                  {summary.boxesNotFound > 0 && <span className="text-green-500 ml-1">+{summary.boxesNotFound} yangi</span>}
                </div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="flex items-center justify-center gap-1">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-bold text-foreground">{summary.totalWeight.toFixed(1)}</span>
                </div>
                <div className="text-xs text-muted-foreground">kg jami</div>
              </div>
              <div className="p-3 bg-muted rounded-lg text-center">
                <div className="flex items-center justify-center gap-1">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-lg font-bold text-foreground">{summary.totalShippingCost.toFixed(0)}</span>
                </div>
                <div className="text-xs text-muted-foreground">yetkazish narxi</div>
              </div>
            </div>
            
            <Tabs defaultValue="shipments" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="w-full justify-start bg-muted">
              <TabsTrigger value="shipments" className="gap-1">
                  <Ship className="h-4 w-4" />
                  <span className="hidden sm:inline">Jo'natmalar</span> ({parsedData.length})
                </TabsTrigger>
                <TabsTrigger value="boxes" className="gap-1">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Qutilar</span> ({parsedData.flatMap(s => s.boxes).length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="shipments" className="flex-1 mt-0 overflow-hidden">
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2 p-2">
                    {parsedData.map((shipment, idx) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground">{shipment.receiptNumber}</span>
                            <Badge variant={shipment.isExisting ? 'secondary' : 'default'} className="text-xs">
                              {shipment.isExisting ? 'Yangilanadi' : 'Yangi'}
                            </Badge>
                          </div>
                          <Badge variant="outline" className={`text-xs ${
                            shipment.status === 'arrived' ? 'text-green-500 border-green-500/30' : 
                            shipment.status === 'in_transit' ? 'text-blue-500 border-blue-500/30' : ''
                          }`}>
                            {shipment.status === 'arrived' ? 'Yetib kelgan' : 
                             shipment.status === 'in_transit' ? 'Yo\'lda' : 'Kutilmoqda'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                          <span>{shipment.boxes.length} ta quti</span>
                          <span>{shipment.totalWeight.toFixed(2)} kg</span>
                          <span>{shipment.totalVolume.toFixed(4)} m³</span>
                          {shipment.totalShippingCost > 0 && (
                            <span>${shipment.totalShippingCost.toFixed(0)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="boxes" className="flex-1 mt-0 overflow-hidden">
                <ScrollArea className="h-[280px]">
                  <div className="space-y-2 p-2">
                    {parsedData.flatMap(shipment => 
                      shipment.boxes.map((box, idx) => (
                        <div key={`${shipment.receiptNumber}-${idx}`} className={`p-3 rounded-lg ${
                          box.trackCodeNotFound ? 'bg-yellow-500/5 border border-yellow-500/20' : 'bg-muted/50'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm text-foreground">{box.boxNumber}</span>
                              {getBoxBadge(box)}
                              {getWeightBadge(box)}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                             {box.weightKg && <span>{box.weightKg.toFixed(2)} kg</span>}
                             {box.lengthCm && box.widthCm && box.heightCm && (
                               <span>{box.lengthCm}×{box.widthCm}×{box.heightCm} sm</span>
                             )}
                             {box.shippingCost && <span>${box.shippingCost.toFixed(0)}</span>}
                             {box.packageType && <span className="text-muted-foreground/70">{box.packageType}</span>}
                           </div>
                           {box.trackCode && (
                             <p className="text-xs text-primary font-mono mt-1">
                               🏷️ Trek: {box.trackCode}
                             </p>
                           )}
                           {box.weightMismatch && (
                             <p className="text-xs text-yellow-500 mt-1">
                               ⚠️ Og'irlik farqi: {box.weightMismatch}
                             </p>
                           )}
                           {box.productDescription && (
                             <p className="text-xs text-muted-foreground mt-1 truncate" title={box.productDescription}>
                               📦 {box.productDescription}
                             </p>
                           )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
        
        {stage === 'importing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-4">Import jarayonida...</h3>
            <div className="w-full max-w-xs">
              <Progress value={importProgress} className="h-2 mb-2" />
              <p className="text-sm text-muted-foreground text-center">{importProgress}%</p>
            </div>
          </div>
        )}
        
        {stage === 'complete' && importResults && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Import yakunlandi!</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6 mt-4">
              <div className="p-4 bg-green-500/10 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-500">{importResults.success}</div>
                <div className="text-sm text-muted-foreground">Muvaffaqiyatli</div>
              </div>
              <div className="p-4 bg-red-500/10 rounded-lg text-center">
                <div className="text-3xl font-bold text-red-500">{importResults.failed}</div>
                <div className="text-sm text-muted-foreground">Xato</div>
              </div>
            </div>
            
          </div>
        )}
        
        <DialogFooter className="gap-2 sm:gap-0">
          {stage === 'preview' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Bekor qilish
              </Button>
              <Button 
                className="gap-2 bg-gradient-to-r from-primary to-secondary"
                onClick={handleImport}
              >
                <ChevronRight className="h-4 w-4" />
                Importni boshlash
              </Button>
            </>
          )}
          {stage === 'complete' && (
            <Button onClick={handleClose}>
              Yopish
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
