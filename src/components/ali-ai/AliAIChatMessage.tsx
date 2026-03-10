import { Bot, User, Copy, Check, Pin } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AliAIRichContentParser } from './AliAIRichContentParser';
import { AliAIFeedback } from './AliAIFeedback';
import { pinMessage } from './index';
import { useTranslation } from 'react-i18next';

interface AliAIChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  isStreaming?: boolean;
  messageId?: string;
  conversationId?: string | null;
  conversationTitle?: string;
  showFeedback?: boolean;
  metadata?: {
    model?: string;
    complexity?: string;
  };
  onAction?: (action: string, data?: any) => void;
}

export function AliAIChatMessage({ 
  role, 
  content, 
  createdAt, 
  isStreaming, 
  messageId,
  conversationId,
  conversationTitle,
  showFeedback = true,
  metadata, 
  onAction 
}: AliAIChatMessageProps) {
  const isUser = role === 'user';
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  // Sanitize content - simple approach: remove control chars and BOM only
  const sanitizedContent = useMemo(() => {
    if (!content) return '';
    
    // Remove BOM (byte order mark) characters
    let cleaned = content.replace(/^\uFEFF/, '');
    
    // Remove control characters (except newlines and tabs)
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    return cleaned.trim();
  }, [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sanitizedContent);
      setCopied(true);
      toast.success(t('ai_copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('ai_copy_error'));
    }
  };

  const handlePin = () => {
    if (conversationId) {
      pinMessage(sanitizedContent, conversationId, conversationTitle);
    }
  };

  const handleAction = useCallback((action: string, data?: any) => {
    onAction?.(action, data);
  }, [onAction]);

  return (
    <div className={cn('flex gap-3 group w-full min-w-0 overflow-hidden', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-md">
          <Bot className="h-4 w-4 text-white" />
        </div>
      )}
      
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 relative min-w-0 break-words',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{content}</p>
        ) : isStreaming && !sanitizedContent ? (
          <div className="flex items-center gap-2 py-1">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground animate-pulse">{t('ai_writing_response')}</span>
          </div>
        ) : (
          <div className="min-w-0 break-words [overflow-wrap:anywhere]">
            <AliAIRichContentParser 
              content={sanitizedContent} 
              onAction={handleAction}
            />
            
            {/* Streaming cursor */}
            {isStreaming && sanitizedContent && (
              <span className="inline-block w-2 h-4 bg-primary ml-0.5 animate-pulse" />
            )}
          </div>
        )}
        
        {/* Action buttons for assistant messages - now inside the bubble */}
        {!isUser && !isStreaming && sanitizedContent && (
          <div className="flex gap-1 mt-2 pt-2 border-t border-border/50">
            {/* Pin button */}
            {conversationId && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handlePin}
                title={t('ai_pin')}
              >
                <Pin className="h-3 w-3 text-muted-foreground hover:text-yellow-500" />
              </Button>
            )}
            
            {/* Copy button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </Button>
          </div>
        )}
        
        {/* Feedback for assistant messages */}
        {!isUser && !isStreaming && sanitizedContent && showFeedback && conversationId && (
          <AliAIFeedback
            messageId={messageId}
            conversationId={conversationId}
            messageContent={sanitizedContent}
          />
        )}
        
        {!isStreaming && (
          <p className={cn('text-xs mt-1', isUser ? 'opacity-70' : 'text-muted-foreground')}>
            {format(new Date(createdAt), 'HH:mm')}
          </p>
        )}
      </div>
      
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
          <User className="h-4 w-4 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
