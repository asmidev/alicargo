import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTelegramAlert } from '@/hooks/useTelegramAlert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Send, 
  Hash
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  id: string;
  sender_id: string;
  channel: string;
  content: string;
  reply_to_id: string | null;
  mentions: string[];
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
}

const CHANNEL_IDS = ['general', 'china', 'uzbekistan', 'urgent'] as const;
const CHANNEL_LABEL_KEYS: Record<string, string> = {
  general: 'collab_ch_general',
  china: 'collab_ch_china',
  uzbekistan: 'collab_ch_uzbekistan',
  urgent: 'collab_ch_urgent',
};

export function TeamChat() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { notifyNewMessage } = useTelegramAlert();
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChannel, setActiveChannel] = useState('general');
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null; avatar_url: string | null }>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('team_messages')
      .select('*')
      .eq('channel', activeChannel)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      const userIds = [...new Set(data.map(m => m.sender_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);

        const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
        profileData?.forEach(p => {
          profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        });
        setProfiles(prev => ({ ...prev, ...profileMap }));
      }
      setMessages(data);

      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 50);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchMessages();
  }, [activeChannel]);

  useEffect(() => {
    const channel = supabase
      .channel(`team-chat-${activeChannel}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'team_messages',
          filter: `channel=eq.${activeChannel}`
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          
          if (!profiles[newMsg.sender_id]) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url')
              .eq('id', newMsg.sender_id)
              .single();
            
            if (profile) {
              setProfiles(prev => ({
                ...prev,
                [profile.id]: { full_name: profile.full_name, avatar_url: profile.avatar_url }
              }));
            }
          }
          
          setMessages(prev => [...prev, newMsg]);
          
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }, 50);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChannel, profiles]);

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim()) return;

    const messageContent = newMessage.trim();
    setIsSending(true);
    
    const senderProfile = profiles[user.id];
    const senderName = senderProfile?.full_name || t('collab_user');
    
    const { error } = await supabase
      .from('team_messages')
      .insert({
        sender_id: user.id,
        channel: activeChannel,
        content: messageContent
      });

    if (error) {
      toast.error(t('collab_send_error'));
    } else {
      setNewMessage('');
      inputRef.current?.focus();
      
      notifyNewMessage(user.id, senderName, messageContent.slice(0, 200), activeChannel);
      
      if (activeChannel === 'urgent') {
        await supabase.from('activity_feed').insert({
          user_id: user.id,
          activity_type: 'message',
          title: t('collab_urgent_sent'),
          description: messageContent.slice(0, 100),
          metadata: { channel: activeChannel }
        });
      }
    }
    setIsSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const groupedMessages = messages.reduce((acc, msg, idx) => {
    const prevMsg = messages[idx - 1];
    const showHeader = !prevMsg || prevMsg.sender_id !== msg.sender_id || 
      new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 5 * 60 * 1000;
    
    acc.push({ ...msg, showHeader });
    return acc;
  }, [] as (Message & { showHeader: boolean })[]);

  const channelLabel = t(CHANNEL_LABEL_KEYS[activeChannel] || 'collab_ch_general');

  return (
    <div className="h-full flex flex-col bg-background rounded-lg border">
      <div className="px-3 pt-3 shrink-0">
        <Tabs value={activeChannel} onValueChange={setActiveChannel}>
          <TabsList className="w-full grid grid-cols-4 h-9">
            {CHANNEL_IDS.map(ch => (
              <TabsTrigger key={ch} value={ch} className="text-xs px-2">
                {t(CHANNEL_LABEL_KEYS[ch])}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1 px-3" ref={scrollRef}>
        <div className="py-4 space-y-1">
          {isLoading ? (
            <LoadingSkeleton count={3} compact />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Hash className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">{t('collab_start_chat')}</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[200px]">
                {t('collab_no_messages')}
              </p>
            </div>
          ) : (
            groupedMessages.map((msg) => {
              const profile = profiles[msg.sender_id];
              const isOwnMessage = msg.sender_id === user?.id;
              
              return (
                <div key={msg.id} className={msg.showHeader ? 'pt-3' : ''}>
                  {msg.showHeader && (
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={profile?.avatar_url || ''} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className={`text-sm font-medium ${isOwnMessage ? 'text-primary' : 'text-foreground'}`}>
                        {profile?.full_name || t('collab_unknown_user')}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(msg.created_at), {
                          addSuffix: true,
                          locale: uz
                        })}
                      </span>
                    </div>
                  )}
                  <div className="pl-9">
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t shrink-0">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={t('collab_type_message', { channel: channelLabel })}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            className="h-10"
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={isSending || !newMessage.trim()}
            size="icon"
            className="h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}