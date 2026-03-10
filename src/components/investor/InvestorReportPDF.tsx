import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';

interface FinancialPeriod {
  id: string;
  period_start: string;
  period_end: string;
  revenue: number | null;
  cost_of_goods_sold: number | null;
  operating_expenses: number | null;
  gross_profit: number | null;
  net_profit: number | null;
}

interface InvestorReport {
  id: string;
  report_period: string;
  investment_amount: number | null;
  profit_amount: number | null;
  roi_percentage: number | null;
  status: string | null;
  notes: string | null;
  created_at: string;
}

interface InvestorReportPDFProps {
  reports: InvestorReport[];
  periods: FinancialPeriod[];
  totalInvestment: number;
  totalProfit: number;
  avgROI: number;
  investorName?: string;
}

export function InvestorReportPDF({
  reports,
  periods,
  totalInvestment,
  totalProfit,
  avgROI,
  investorName = 'Investor'
}: InvestorReportPDFProps) {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      let yPos = margin;
      
      const checkPageBreak = (requiredSpace: number) => {
        if (yPos + requiredSpace > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      const primaryColor: [number, number, number] = [59, 130, 246];
      const successColor: [number, number, number] = [34, 197, 94];
      const dangerColor: [number, number, number] = [239, 68, 68];
      const mutedColor: [number, number, number] = [107, 114, 128];
      const darkColor: [number, number, number] = [17, 24, 39];

      // Header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('AliBrand', margin, 25);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(t('inv_rpt_title'), margin, 35);
      
      doc.setFontSize(10);
      doc.text(format(new Date(), 'dd MMMM yyyy', { locale: uz }), pageWidth - margin - 40, 35);
      
      yPos = 60;

      doc.setTextColor(...darkColor);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(t('inv_rpt_dear', { name: investorName }), margin, yPos);
      yPos += 15;

      // Summary
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 50, 3, 3, 'F');
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...darkColor);
      doc.text(t('inv_rpt_summary'), margin + 10, yPos + 12);
      
      const summaryY = yPos + 25;
      const colWidth = (pageWidth - margin * 2 - 20) / 4;
      
      const summaryItems = [
        { label: t('inv_rpt_total_investment'), value: `$${totalInvestment.toLocaleString()}`, color: darkColor },
        { label: t('inv_rpt_total_profit'), value: `$${totalProfit.toLocaleString()}`, color: totalProfit >= 0 ? successColor : dangerColor },
        { label: t('inv_rpt_avg_roi'), value: `${avgROI.toFixed(1)}%`, color: avgROI >= 0 ? successColor : dangerColor },
        { label: t('inv_rpt_reports_count'), value: reports.length.toString(), color: darkColor }
      ];

      summaryItems.forEach((item, index) => {
        const x = margin + 10 + index * colWidth;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...mutedColor);
        doc.text(item.label, x, summaryY);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...item.color);
        doc.text(item.value, x, summaryY + 10);
      });
      
      yPos += 65;

      // Monthly P&L
      if (periods.length > 0) {
        checkPageBreak(80);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkColor);
        doc.text(t('inv_rpt_monthly_pl'), margin, yPos);
        yPos += 10;
        
        doc.setFillColor(...primaryColor);
        doc.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        
        const plColWidths = [50, 35, 35, 35, 35];
        let xPos = margin + 5;
        [t('inv_rpt_period'), t('inv_rpt_revenue'), t('inv_rpt_cogs'), t('inv_rpt_expenses'), t('inv_rpt_profit')].forEach((header, i) => {
          doc.text(header, xPos, yPos + 7);
          xPos += plColWidths[i];
        });
        
        yPos += 12;
        
        doc.setFont('helvetica', 'normal');
        periods.forEach((period, index) => {
          checkPageBreak(12);
          
          const profit = (period.revenue || 0) - (period.cost_of_goods_sold || 0) - (period.operating_expenses || 0);
          
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(margin, yPos - 4, pageWidth - margin * 2, 10, 'F');
          }
          
          xPos = margin + 5;
          doc.setTextColor(...darkColor);
          doc.setFontSize(9);
          doc.text(format(new Date(period.period_start), 'MMM yyyy', { locale: uz }), xPos, yPos + 2);
          xPos += plColWidths[0];
          
          doc.setTextColor(...successColor);
          doc.text(`$${(period.revenue || 0).toLocaleString()}`, xPos, yPos + 2);
          xPos += plColWidths[1];
          
          doc.setTextColor(...dangerColor);
          doc.text(`$${(period.cost_of_goods_sold || 0).toLocaleString()}`, xPos, yPos + 2);
          xPos += plColWidths[2];
          
          doc.setTextColor(...dangerColor);
          doc.text(`$${(period.operating_expenses || 0).toLocaleString()}`, xPos, yPos + 2);
          xPos += plColWidths[3];
          
          doc.setTextColor(...(profit >= 0 ? successColor : dangerColor));
          doc.setFont('helvetica', 'bold');
          doc.text(`$${profit.toLocaleString()}`, xPos, yPos + 2);
          
          yPos += 10;
        });
        
        yPos += 10;
      }

      // Recent Reports
      if (reports.length > 0) {
        checkPageBreak(60);
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...darkColor);
        doc.text(t('inv_rpt_recent'), margin, yPos);
        yPos += 10;
        
        doc.setFillColor(...primaryColor);
        doc.rect(margin, yPos, pageWidth - margin * 2, 10, 'F');
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        
        const reportColWidths = [45, 40, 40, 30, 35];
        let headerX = margin + 5;
        [t('inv_rpt_period'), t('inv_rpt_investment'), t('inv_rpt_profit'), t('inv_rpt_roi'), t('inv_rpt_status')].forEach((header, i) => {
          doc.text(header, headerX, yPos + 7);
          headerX += reportColWidths[i];
        });
        
        yPos += 12;
        
        reports.slice(0, 10).forEach((report, index) => {
          checkPageBreak(12);
          
          if (index % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(margin, yPos - 4, pageWidth - margin * 2, 10, 'F');
          }
          
          let rowX = margin + 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          
          doc.setTextColor(...darkColor);
          doc.text(report.report_period || '-', rowX, yPos + 2);
          rowX += reportColWidths[0];
          
          doc.text(`$${(report.investment_amount || 0).toLocaleString()}`, rowX, yPos + 2);
          rowX += reportColWidths[1];
          
          doc.setTextColor(...((report.profit_amount || 0) >= 0 ? successColor : dangerColor));
          doc.text(`$${(report.profit_amount || 0).toLocaleString()}`, rowX, yPos + 2);
          rowX += reportColWidths[2];
          
          doc.setTextColor(...((report.roi_percentage || 0) >= 0 ? successColor : dangerColor));
          doc.text(`${(report.roi_percentage || 0).toFixed(1)}%`, rowX, yPos + 2);
          rowX += reportColWidths[3];
          
          doc.setTextColor(...(report.status === 'published' ? successColor : mutedColor));
          doc.text(report.status === 'published' ? t('inv_rpt_published') : t('inv_rpt_draft'), rowX, yPos + 2);
          
          yPos += 10;
        });
      }

      // Footer
      const footerY = pageHeight - 15;
      doc.setDrawColor(...mutedColor);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mutedColor);
      doc.text('AliBrand CRM & AI Logistics Platform', margin, footerY);
      doc.text(t('inv_rpt_created', { date: format(new Date(), 'dd.MM.yyyy HH:mm') }), pageWidth - margin - 50, footerY);
      
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(...mutedColor);
        doc.text(t('inv_rpt_page', { current: i, total: totalPages }), pageWidth / 2, pageHeight - 10, { align: 'center' });
      }

      const fileName = `AliBrand_Investor_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button 
      onClick={generatePDF} 
      disabled={isGenerating}
      variant="outline"
      className="gap-2"
    >
      {isGenerating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {t('inv_rpt_download')}
    </Button>
  );
}