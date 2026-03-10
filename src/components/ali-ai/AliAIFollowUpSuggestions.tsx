import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';

interface AliAIFollowUpSuggestionsProps {
  lastResponse: string;
  onSelect: (question: string) => void;
  isVisible: boolean;
}

// Extract follow-up suggestions based on response content
function generateFollowUps(response: string): string[] {
  const suggestions: string[] = [];
  const lowerResponse = response.toLowerCase();
  
  // Finance-related follow-ups
  if (lowerResponse.includes('daromad') || lowerResponse.includes('xarajat') || lowerResponse.includes('foyda')) {
    suggestions.push("Bu oyni oldingi oy bilan taqqosla");
    suggestions.push("Xarajatlar taqsimotini ko'rsat");
    if (!lowerResponse.includes('grafik')) {
      suggestions.push("Trend grafikini chiz");
    }
  }
  
  // Product-related follow-ups
  if (lowerResponse.includes('mahsulot') || lowerResponse.includes('tovar')) {
    suggestions.push("Eng ko'p sotilgan mahsulotlar qaysi?");
    suggestions.push("Kam qolgan mahsulotlar bormi?");
  }
  
  // Box/shipment-related follow-ups
  if (lowerResponse.includes('quti') || lowerResponse.includes('jo\'natma')) {
    suggestions.push("Yo'ldagi qutilar qachon yetib keladi?");
    suggestions.push("Bugungi jo'natmalar holatini ko'rsat");
  }
  
  // Task-related follow-ups
  if (lowerResponse.includes('vazifa') || lowerResponse.includes('topshiriq')) {
    suggestions.push("Muddati o'tgan vazifalar bormi?");
    suggestions.push("Bugungi vazifalarni ko'rsat");
  }
  
  // Claims-related follow-ups
  if (lowerResponse.includes("da'vo") || lowerResponse.includes('defekt') || lowerResponse.includes('kompensatsiya')) {
    suggestions.push("Kutilayotgan da'volar qancha?");
    suggestions.push("Eng ko'p defekt turlari qaysi?");
  }
  
  // Marketplace-related follow-ups (NEW)
  if (lowerResponse.includes('marketplace') || lowerResponse.includes('uzum') || lowerResponse.includes('yandex') || lowerResponse.includes('buyurtma') || lowerResponse.includes('do\'kon')) {
    suggestions.push("Qaysi do'konim eng yaxshi sotmoqda?");
    suggestions.push("AI narx tavsiyalari bormi?");
    suggestions.push("Raqobatchilar narxlari qanday?");
  }
  
  // AI suggestions related
  if (lowerResponse.includes('tavsiya') || lowerResponse.includes('narx') || lowerResponse.includes('price')) {
    suggestions.push("Barcha AI tavsiyalarini ko'rsat");
    suggestions.push("Eng yuqori ishonchli tavsiyalar qaysi?");
  }
  
  // Competitor related
  if (lowerResponse.includes('raqobat') || lowerResponse.includes('competitor')) {
    suggestions.push("Raqobatchilar narx o'zgarishi bormi?");
    suggestions.push("Qaysi mahsulotlarda raqobat kuchli?");
  }
  
  // Analytics follow-ups
  if (lowerResponse.includes('statistika') || lowerResponse.includes('tahlil')) {
    suggestions.push("Batafsil tahlil ber");
    suggestions.push("Grafik shaklda ko'rsat");
  }
  
  // If table detected, suggest export
  if (lowerResponse.includes('|') && lowerResponse.includes('---')) {
    suggestions.push("Buni jadval sifatida ko'rsat");
  }
  
  // Generic follow-ups if nothing specific
  if (suggestions.length === 0) {
    suggestions.push("Batafsil tushuntir");
    suggestions.push("Marketplace holatini ko'rsat");
    suggestions.push("Bugungi umumiy statistika qanday?");
  }
  
  // Limit to 3 unique suggestions
  return [...new Set(suggestions)].slice(0, 3);
}

export function AliAIFollowUpSuggestions({ lastResponse, onSelect, isVisible }: AliAIFollowUpSuggestionsProps) {
  const suggestions = useMemo(() => generateFollowUps(lastResponse), [lastResponse]);
  
  if (!isVisible || !lastResponse || suggestions.length === 0) {
    return null;
  }
  
  return (
    <div className="flex flex-wrap gap-2 mt-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-full flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Sparkles className="h-3 w-3" />
        <span>Davom ettirish:</span>
      </div>
      {suggestions.map((suggestion, idx) => (
        <Button
          key={idx}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion)}
          className="h-7 text-xs gap-1 hover:bg-primary/10 hover:border-primary/30 transition-colors"
        >
          {suggestion}
          <ArrowRight className="h-3 w-3" />
        </Button>
      ))}
    </div>
  );
}
