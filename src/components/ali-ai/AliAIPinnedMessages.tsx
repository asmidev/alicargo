import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pin, X, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PinnedMessage {
  id: string;
  content: string;
  pinnedAt: string;
  conversationId: string;
  conversationTitle?: string;
}

interface AliAIPinnedMessagesProps {
  onNavigateToMessage?: (conversationId: string) => void;
}

const STORAGE_KEY = 'ali-ai-pinned-messages';

export function AliAIPinnedMessages({ onNavigateToMessage }: AliAIPinnedMessagesProps) {
  const { t } = useTranslation();
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setPinnedMessages(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing pinned messages:', e);
      }
    }
  }, []);

  const savePinnedMessages = (messages: PinnedMessage[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    setPinnedMessages(messages);
  };

  const unpinMessage = (id: string) => {
    const updated = pinnedMessages.filter(m => m.id !== id);
    savePinnedMessages(updated);
    toast.success(t('ai_message_unpinned'));
  };

  if (pinnedMessages.length === 0) {
    return null;
  }

  return (
    <Card className="p-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-between h-7 px-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center gap-1.5 text-xs">
          <Pin className="h-3 w-3 text-yellow-500" />
          {t('ai_pinned')} ({pinnedMessages.length})
        </span>
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </Button>

      {isExpanded && (
        <ScrollArea className="max-h-48 mt-2">
          <div className="space-y-2">
            {pinnedMessages.map((msg) => (
              <div 
                key={msg.id} 
                className="p-2 bg-muted/50 rounded-md text-xs group relative"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5">
                    {msg.conversationTitle || t('ai_new_conv')}
                  </Badge>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onNavigateToMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => onNavigateToMessage(msg.conversationId)}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 text-destructive"
                      onClick={() => unpinMessage(msg.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground line-clamp-2">
                  {msg.content.replace(/[#*`]/g, '').substring(0, 150)}...
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {format(new Date(msg.pinnedAt), 'dd.MM.yyyy HH:mm')}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </Card>
  );
}

// Utility function to pin a message (uses i18n via toast)
export function pinMessage(
  content: string, 
  conversationId: string, 
  conversationTitle?: string
): void {
  const stored = localStorage.getItem(STORAGE_KEY);
  const messages: PinnedMessage[] = stored ? JSON.parse(stored) : [];
  
  const exists = messages.some(m => 
    m.content.substring(0, 100) === content.substring(0, 100) && 
    m.conversationId === conversationId
  );
  
  if (exists) {
    toast.info("Bu xabar allaqachon qadoqlangan");
    return;
  }
  
  if (messages.length >= 10) {
    toast.error("Maksimum 10 ta xabar qadoqlash mumkin");
    return;
  }
  
  const newMessage: PinnedMessage = {
    id: `pin-${Date.now()}`,
    content,
    pinnedAt: new Date().toISOString(),
    conversationId,
    conversationTitle,
  };
  
  messages.unshift(newMessage);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  toast.success("Xabar qadoqlandi");
  
  window.dispatchEvent(new CustomEvent('ali-ai-pin-updated'));
}
