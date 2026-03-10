import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Calendar,
  RefreshCw,
  Send,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { uz } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

interface Digest {
  id: string;
  user_id: string;
  digest_type: string;
  digest_date: string;
  content: string;
  metrics: Record<string, any>;
  sent_via: string[];
  created_at: string;
}

interface AliAIDailyDigestProps {
  compact?: boolean;
}

export function AliAIDailyDigest({ compact = false }: AliAIDailyDigestProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { userRoles } = useUserRole();
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const primaryRole = userRoles[0] || 'support';

  // Fetch today's digest
  const { data: digest, isLoading } = useQuery({
    queryKey: ['ali-ai-digest', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('ali_ai_digests')
        .select('content, digest_date, digest_type, created_at, sent_via, metrics, id, user_id')
        .eq('user_id', user?.id)
        .eq('digest_date', today)
        .maybeSingle();

      if (error) {
        console.warn('Digest fetch failed:', error.code, error.message);
        return null;
      }
      return data as Digest | null;
    },
    enabled: !!user,
  });

  // Generate digest mutation
  const generateMutation = useMutation({
    mutationFn: async (sendTelegram: boolean = false) => {
      setIsGenerating(true);
      const { data: sessionData } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ali-ai-digest`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({
            userId: user?.id,
            role: primaryRole,
            sendTelegram,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to generate digest');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ali-ai-digest'] });
      toast.success(
        data.telegram_sent
          ? t('ai_digest_telegram')
          : t('ai_digest_created')
      );
    },
    onError: () => {
      toast.error(t('ai_digest_error'));
    },
    onSettled: () => {
      setIsGenerating(false);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className={compact ? "py-2 px-3" : "pb-2"}>
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className={compact ? "px-3 pb-2" : ""}>
          <Skeleton className={compact ? "h-8 w-full" : "h-32 w-full"} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? "py-2 px-3" : "pb-2"}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            {t('ai_digest')}
            {digest && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {format(new Date(digest.created_at), 'HH:mm', { locale: uz })}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateMutation.mutate(false)}
              disabled={isGenerating}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
            </Button>
            {digest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateMutation.mutate(true)}
                disabled={isGenerating}
                className="h-6 w-6 p-0"
                title={t('ai_send_telegram')}
              >
                <Send className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className={compact ? "px-3 pb-2 pt-0" : "pt-0"}>
        {compact ? (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => digest && setIsExpanded(!isExpanded)}
              disabled={!digest}
              className="w-full justify-between h-6 px-1 text-[10px]"
            >
              <span className="text-muted-foreground">
                {!digest 
                  ? t('ai_no_digest') 
                  : format(new Date(digest.digest_date), "d MMM", { locale: uz })}
              </span>
              {digest && (
                isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
              )}
            </Button>
            
            {isExpanded && digest && (
              <ScrollArea className="h-40 mt-1 rounded-md border p-2">
                <div className="prose prose-sm dark:prose-invert max-w-none text-[10px]">
                  <ReactMarkdown>{digest.content}</ReactMarkdown>
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          <>
            {!digest ? (
              <div className="text-center py-4 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">{t('ai_digest_not_created')}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => generateMutation.mutate(false)}
                  disabled={isGenerating}
                  className="mt-2 h-7 text-xs"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      {t('ai_creating')}
                    </>
                  ) : (
                    <>
                      <FileText className="h-3 w-3 mr-1" />
                      {t('ai_create_digest')}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full justify-between text-xs h-7 mb-1"
                >
                  <span>
                    {format(new Date(digest.digest_date), "d MMMM", { locale: uz })}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>

                {isExpanded && (
                  <ScrollArea className="h-48 rounded-md border p-2">
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs">
                      <ReactMarkdown>{digest.content}</ReactMarkdown>
                    </div>
                  </ScrollArea>
                )}

                {!isExpanded && (
                  <p className="text-[10px] text-muted-foreground line-clamp-2">
                    {digest.content.split('\n').slice(0, 2).join(' ')}
                  </p>
                )}

                {digest.sent_via?.includes('telegram') && (
                  <Badge variant="secondary" className="text-[10px] mt-1.5">
                    <Send className="h-2.5 w-2.5 mr-0.5" />
                    {t('ai_sent')}
                  </Badge>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
