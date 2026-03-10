import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, RefreshCw, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ListingAIAnalysisProps {
  listingId: string;
}

export function ListingAIAnalysis({ listingId }: ListingAIAnalysisProps) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('listing-ai-analysis', {
        body: { listing_id: listingId },
      });
      if (fnError) throw fnError;
      setAnalysis(data?.analysis || 'Tahlil mavjud emas');
    } catch (e: any) {
      console.error('AI analysis error:', e);
      setError(e.message || 'AI tahlil xatosi');
    } finally {
      setIsLoading(false);
    }
  };

  if (!analysis && !isLoading && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Brain className="h-12 w-12 text-primary opacity-60" />
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          AI tahlil listing ma'lumotlarini, buyurtmalar tarixini va raqobatchilar narxlarini o'rganib,
          batafsil tavsiyalar beradi.
        </p>
        <Button onClick={fetchAnalysis} className="gap-2">
          <Brain className="h-4 w-4" />
          AI Tahlilni boshlash
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          AI tahlil qilmoqda...
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" style={{ width: `${80 + Math.random() * 20}%` }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-10 w-10 text-destructive opacity-60" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchAnalysis} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Qayta urinish
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Brain className="h-4 w-4" />
          AI tahlili
        </div>
        <Button variant="ghost" size="sm" onClick={fetchAnalysis} className="gap-1">
          <RefreshCw className="h-3 w-3" />
          Yangilash
        </Button>
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_p]:text-sm [&_li]:text-sm">
        <ReactMarkdown>{analysis || ''}</ReactMarkdown>
      </div>
    </div>
  );
}
