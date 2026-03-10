import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Send, Loader2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { toast } from 'sonner';

interface TaskCommentsProps {
  taskId: string;
}

interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: { full_name: string | null; avatar_url: string | null };
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as Comment[];
    },
  });

  // Fetch profiles for comments
  const { data: profiles = {} } = useQuery({
    queryKey: ['profiles-for-comments', comments],
    queryFn: async () => {
      const userIds = new Set(comments.map(c => c.user_id));
      if (userIds.size === 0) return {};

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', Array.from(userIds));

      if (error) throw error;

      const profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      data.forEach(p => {
        profileMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      });
      return profileMap;
    },
    enabled: comments.length > 0,
  });

  // Enrich comments with profiles
  const enrichedComments = comments.map(comment => ({
    ...comment,
    user: profiles[comment.user_id] || null,
  }));

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          user_id: user?.id,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
      setNewComment('');
    },
    onError: () => {
      toast.error(t('error_adding_comment'));
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`task-comments-${taskId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_comments', filter: `task_id=eq.${taskId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment.trim());
    }
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium">{t('comments')}</h4>

      {/* Comments list */}
      <ScrollArea className="h-48">
        <div className="space-y-3 pr-4">
          {isLoading ? (
            <LoadingSkeleton count={3} compact />
          ) : enrichedComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('no_comments')}
            </p>
          ) : (
            enrichedComments.map(comment => (
              <div key={comment.id} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={comment.user?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.user?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {comment.user?.full_name || t('unknown_user')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add comment form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t('add_comment_placeholder')}
          className="min-h-[60px] flex-1"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!newComment.trim() || addCommentMutation.isPending}
        >
          {addCommentMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
