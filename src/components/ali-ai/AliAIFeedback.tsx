import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThumbsUp, ThumbsDown, Flag, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface AliAIFeedbackProps {
  messageId?: string;
  conversationId: string | null;
  messageContent: string;
  onFeedbackSubmit?: (type: 'positive' | 'negative' | 'report', details?: string) => void;
}

export function AliAIFeedback({ 
  messageId, 
  conversationId, 
  messageContent,
  onFeedbackSubmit 
}: AliAIFeedbackProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportText, setReportText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (type: 'positive' | 'negative') => {
    if (!user || !conversationId) return;
    
    setFeedback(type);
    
    try {
      await supabase.from('activity_feed').insert({
        user_id: user.id,
        activity_type: 'ai_feedback',
        title: type === 'positive' ? t('ai_positive_feedback') : t('ai_negative_feedback'),
        description: messageContent.substring(0, 100),
        entity_type: 'ali_ai_message',
        entity_id: messageId || conversationId,
        metadata: { feedback_type: type, message_preview: messageContent.substring(0, 200) },
      });

      onFeedbackSubmit?.(type);
      
      toast.success(type === 'positive' ? t('ai_positive_feedback') : t('ai_negative_feedback'));
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const handleReport = async () => {
    if (!user || !conversationId || !reportText.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      await supabase.from('activity_feed').insert({
        user_id: user.id,
        activity_type: 'ai_report',
        title: t('ai_report_title'),
        description: reportText,
        entity_type: 'ali_ai_message',
        entity_id: messageId || conversationId,
        metadata: { 
          report_text: reportText,
          message_content: messageContent.substring(0, 500),
        },
      });

      onFeedbackSubmit?.('report', reportText);
      setIsReporting(false);
      setReportText('');
      toast.success(t('ai_report_sent'));
    } catch (error) {
      console.error('Report error:', error);
      toast.error(t('ai_report_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!conversationId) return null;

  return (
    <div className="flex items-center gap-1 mt-2">
      <Button
        variant={feedback === 'positive' ? 'default' : 'ghost'}
        size="sm"
        className="h-7 px-2"
        onClick={() => handleFeedback('positive')}
        disabled={feedback !== null}
      >
        <ThumbsUp className={`h-3.5 w-3.5 ${feedback === 'positive' ? 'text-white' : ''}`} />
      </Button>
      
      <Button
        variant={feedback === 'negative' ? 'destructive' : 'ghost'}
        size="sm"
        className="h-7 px-2"
        onClick={() => handleFeedback('negative')}
        disabled={feedback !== null}
      >
        <ThumbsDown className={`h-3.5 w-3.5 ${feedback === 'negative' ? 'text-white' : ''}`} />
      </Button>

      <Popover open={isReporting} onOpenChange={setIsReporting}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 px-2">
            <Flag className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('ai_report_title')}</span>
            </div>
            <Textarea
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder={t('ai_report_placeholder')}
              className="min-h-[80px] text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsReporting(false)}
              >
                {t('cancel')}
              </Button>
              <Button 
                size="sm" 
                onClick={handleReport}
                disabled={!reportText.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Yuborish'
                )}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
