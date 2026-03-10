import { Sparkles, TrendingUp, BarChart3, PieChart, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AliAISuggestionsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

// Determine icon based on suggestion content
function getSuggestionIcon(suggestion: string) {
  const lower = suggestion.toLowerCase();
  if (lower.includes('trend') || lower.includes('dinamika') || lower.includes('o\'sish')) {
    return TrendingUp;
  }
  if (lower.includes('taqqosla') || lower.includes('qiyosla') || lower.includes('compare')) {
    return BarChart3;
  }
  if (lower.includes('taqsimot') || lower.includes('kategoriya') || lower.includes('foiz')) {
    return PieChart;
  }
  if (lower.includes('foyda') || lower.includes('roi') || lower.includes('moliya')) {
    return Calculator;
  }
  return Sparkles;
}

export function AliAISuggestions({ suggestions, onSelect }: AliAISuggestionsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto">
      {suggestions.map((suggestion, idx) => {
        const Icon = getSuggestionIcon(suggestion);
        return (
          <Button
            key={idx}
            variant="outline"
            className="justify-start text-left h-auto py-3 px-4 hover:bg-primary/5 hover:border-primary/30 transition-all"
            onClick={() => onSelect(suggestion)}
          >
            <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
            <span className="truncate text-sm">{suggestion}</span>
          </Button>
        );
      })}
    </div>
  );
}

// Get suggestions based on user roles with comprehensive question coverage
export function getSuggestedQuestions(roles: string[]): string[] {
  const questions: string[] = [];

  // Universal questions for all roles
  questions.push(
    "Bugungi umumiy statistika qanday?",
    "Qanday muammolar bor?"
  );

  if (roles.includes('rahbar') || roles.includes('bosh_admin')) {
    questions.push(
      // Sales & Best Sellers
      "Eng ko'p sotilgan TOP-10 mahsulot",
      "Bugun eng ko'p sotilgan mahsulotlar",
      "Bu hafta qaysi mahsulot yaxshi sotildi?",
      // Finance
      "Bu oyni oldingi oy bilan taqqosla",
      "Moliyaviy trend qanday?",
      "Foyda margin qancha foiz?",
      // Marketplace
      "Uzum va Yandexni taqqosla",
      "Qaysi do'kon eng yaxshi sotmoqda?",
      // Operations
      "Kam qolgan mahsulotlar ro'yxati",
      "Qarzlar holati qanday?",
      // Forecasting
      "Keyingi hafta prognozi"
    );
  }

  if (roles.includes('moliya_xodimi')) {
    questions.push(
      // Finance specific
      "Bu oylik vs oldingi oylik taqqoslash",
      "Eng katta xarajat kategoriyalari",
      "Foyda margin tahlili",
      "Oylik cash flow",
      "Xarajat/daromad nisbati",
      "Haftalik moliya trendi",
      // Debts
      "Qarzlar holati",
      "Muddati o'tgan to'lovlar"
    );
  }

  if (roles.includes('xitoy_manager') || roles.includes('xitoy_packer')) {
    questions.push(
      "Qadoqlanayotgan qutilar soni?",
      "Bugungi vazifalar?",
      "Inventar holati?",
      "Tekshirish kutayotgan qutilar?",
      "Defektli mahsulotlar bormi?",
      "Haftalik qadoqlash statistikasi",
      "Muhrlangan qutilar"
    );
  }

  if (roles.includes('uz_manager') || roles.includes('uz_receiver')) {
    questions.push(
      "Kutilayotgan jo'natmalar?",
      "Bugungi qabul qilish vazifalari?",
      "Haftalik yetib kelishlar tahlili",
      "Tekshirish sessiyalari holati",
      "Kam qolgan mahsulotlar",
      "To'g'ridan-to'g'ri sotuvlar"
    );
  }

  if (roles.includes('investor')) {
    questions.push(
      "Mening investitsiyam ROI?",
      "Oylik foyda tahlili",
      "Rentabellik dinamikasi",
      "Investitsiya qaytimi prognozi",
      "Jami daromad va xarajatlar"
    );
  }

  if (roles.includes('marketplace_manager')) {
    questions.push(
      "Eng yaxshi sotilayotgan mahsulotlar?",
      "Kategoriya bo'yicha sotuvlar",
      "Stock turnover tahlili",
      "Raqobatchi narxlari",
      "AI narx tavsiyalari",
      "Kam stock mahsulotlar"
    );
  }

  if (roles.includes('sales_manager')) {
    questions.push(
      "Bugungi sotuvlar trendi?",
      "TOP-10 mahsulotlar",
      "Narx margin tahlili",
      "Haftalik sotuv dinamikasi",
      "Kecha vs bugun taqqoslash"
    );
  }

  // Return unique questions, max 8
  return [...new Set(questions)].slice(0, 8);
}