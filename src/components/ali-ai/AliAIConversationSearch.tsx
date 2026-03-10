import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, Clock, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface AliAIConversationSearchProps {
  conversations: Conversation[];
  onSelect: (conversationId: string) => void;
  activeConversationId: string | null;
}

export function AliAIConversationSearch({ 
  conversations, 
  onSelect, 
  activeConversationId 
}: AliAIConversationSearchProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.title?.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery]);
  
  return (
    <div className="space-y-2">
      {isSearching ? (
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('ai_search_conv')}
              className="h-7 pl-7 pr-7 text-xs"
              autoFocus
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-7 w-7"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setIsSearching(false);
              setSearchQuery('');
            }}
          >
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 justify-start text-xs text-muted-foreground"
          onClick={() => setIsSearching(true)}
        >
          <Search className="h-3 w-3 mr-1" />
          {t('search')}...
        </Button>
      )}
      
      {isSearching && searchQuery && (
        <p className="text-[10px] text-muted-foreground px-1">
          {t('ai_results_count', { count: filteredConversations.length })}
        </p>
      )}
      
      <ScrollArea className="h-[calc(100%-60px)]">
        <div className="space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">
                {searchQuery ? t('ai_no_results_found') : t('ai_no_conv')}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-2 rounded-md cursor-pointer transition-all group ${
                  activeConversationId === conv.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted border border-transparent'
                }`}
                onClick={() => onSelect(conv.id)}
              >
                <p className="text-xs font-medium truncate">
                  {conv.title || t('ai_new_conv')}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {format(new Date(conv.updated_at), 'dd.MM HH:mm')}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
