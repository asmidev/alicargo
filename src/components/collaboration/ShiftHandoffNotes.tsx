import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ClipboardList, 
  Plus, 
  Check,
  Send
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uz } from 'date-fns/locale';
import { toast } from 'sonner';

interface Handoff {
  id: string;
  from_user_id: string;
  to_user_id: string | null;
  to_role: string | null;
  location: string;
  title: string;
  content: string;
  priority: string;
  is_read: boolean;
  read_at: string | null;
  read_by: string | null;
  created_at: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
};

const PRIORITY_LABEL_KEYS: Record<string, string> = {
  low: 'collab_priority_low',
  normal: 'collab_priority_normal',
  high: 'collab_priority_high',
  urgent: 'collab_priority_urgent',
};

export function ShiftHandoffNotes({ location = 'china' }: { location?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string | null }>>({});
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchHandoffs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('shift_handoffs')
      .select('*')
      .eq('location', location)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      const userIds = [...new Set(data.map(h => h.from_user_id))];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);

        const profileMap: Record<string, { full_name: string | null }> = {};
        profileData?.forEach(p => {
          profileMap[p.id] = { full_name: p.full_name };
        });
        setProfiles(profileMap);
      }
      setHandoffs(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchHandoffs();

    const channel = supabase
      .channel('shift-handoffs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shift_handoffs',
          filter: `location=eq.${location}`
        },
        () => {
          fetchHandoffs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [location]);

  const handleCreateHandoff = async () => {
    if (!user || !title.trim() || !content.trim()) return;

    setIsSubmitting(true);
    const { error } = await supabase
      .from('shift_handoffs')
      .insert({
        from_user_id: user.id,
        location,
        title: title.trim(),
        content: content.trim(),
        priority
      });

    if (error) {
      toast.error(t('collab_note_error'));
    } else {
      toast.success(t('collab_note_created'));
      setTitle('');
      setContent('');
      setPriority('normal');
      setIsDialogOpen(false);

      await supabase.from('activity_feed').insert({
        user_id: user.id,
        activity_type: 'handoff',
        title: t('collab_shift_note', { title: title.trim() }),
        description: content.trim().slice(0, 100),
        metadata: { location, priority }
      });
    }
    setIsSubmitting(false);
  };

  const handleMarkAsRead = async (handoff: Handoff) => {
    if (!user) return;

    const { error } = await supabase
      .from('shift_handoffs')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        read_by: user.id
      })
      .eq('id', handoff.id);

    if (!error) {
      toast.success(t('collab_marked_read'));
    }
  };

  const unreadCount = handoffs.filter(h => !h.is_read).length;

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">{t('collab_notes_title')}</span>
          </div>
        </div>
        <LoadingSkeleton count={3} compact />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{t('collab_notes_title')}</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-8">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('collab_new')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('collab_create_note')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder={t('collab_note_title')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder={t('collab_note_text')}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
              />
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder={t('collab_priority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('collab_priority_low')}</SelectItem>
                  <SelectItem value="normal">{t('collab_priority_normal')}</SelectItem>
                  <SelectItem value="high">{t('collab_priority_high')}</SelectItem>
                  <SelectItem value="urgent">{t('collab_priority_urgent')}</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleCreateHandoff} 
                disabled={isSubmitting || !title.trim() || !content.trim()}
                className="w-full"
              >
                <Send className="h-4 w-4 mr-2" />
                {t('collab_submit')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1 -mx-1 px-1">
        {handoffs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('collab_no_notes')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('collab_notes_hint')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {handoffs.map((handoff) => {
              const priorityColor = PRIORITY_COLOR[handoff.priority] || PRIORITY_COLOR.normal;
              const priorityLabel = t(PRIORITY_LABEL_KEYS[handoff.priority] || 'collab_priority_normal');
              const profile = profiles[handoff.from_user_id];
              
              return (
                <div
                  key={handoff.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    !handoff.is_read 
                      ? 'bg-primary/5 border-primary/20' 
                      : 'bg-muted/30 border-transparent hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        <Badge className={`text-[10px] px-1.5 py-0 ${priorityColor}`}>
                          {priorityLabel}
                        </Badge>
                        {!handoff.is_read && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t('collab_new_badge')}
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-medium text-sm leading-tight">{handoff.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {handoff.content}
                      </p>
                      <div className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground">
                        <span>{profile?.full_name || t('collab_unknown_user')}</span>
                        <span>·</span>
                        <span>
                          {formatDistanceToNow(new Date(handoff.created_at), {
                            addSuffix: true,
                            locale: uz
                          })}
                        </span>
                      </div>
                    </div>
                    {!handoff.is_read && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        onClick={() => handleMarkAsRead(handoff)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}