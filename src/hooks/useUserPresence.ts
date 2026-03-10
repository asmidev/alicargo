import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UserPresence {
  id: string;
  user_id: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  current_activity: string | null;
  current_entity_id: string | null;
  current_entity_type: string | null;
  last_seen_at: string;
  location: string | null;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export function useUserPresence() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all online users
  const fetchOnlineUsers = useCallback(async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('user_presence')
      .select('*')
      .gte('last_seen_at', fiveMinutesAgo)
      .neq('status', 'offline');

    if (!error && data) {
      // Fetch profiles for online users
      const userIds = data.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const usersWithProfiles = data.map(presence => ({
        ...presence,
        profile: profiles?.find(p => p.id === presence.user_id)
      })) as UserPresence[];

      setOnlineUsers(usersWithProfiles);
    }
    setIsLoading(false);
  }, []);

  // Update own presence
  const updatePresence = useCallback(async (
    status: 'online' | 'away' | 'busy' | 'offline',
    activity?: string,
    entityId?: string,
    entityType?: string,
    location?: string
  ) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_presence')
      .upsert({
        user_id: user.id,
        status,
        current_activity: activity || null,
        current_entity_id: entityId || null,
        current_entity_type: entityType || null,
        location: location || null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) console.error('Error updating presence:', error);
  }, [user]);

  // Set activity (e.g., when verifying a box)
  const setActivity = useCallback((
    activity: string,
    entityId?: string,
    entityType?: string
  ) => {
    updatePresence('busy', activity, entityId, entityType);
  }, [updatePresence]);

  // Clear activity
  const clearActivity = useCallback(() => {
    updatePresence('online');
  }, [updatePresence]);

  // Go offline
  const goOffline = useCallback(() => {
    updatePresence('offline');
  }, [updatePresence]);

  useEffect(() => {
    if (!user) return;

    // Set initial presence
    updatePresence('online');
    fetchOnlineUsers();

    // Heartbeat - update presence every minute
    const heartbeat = setInterval(() => {
      updatePresence('online');
    }, 60000);

    // Listen for presence changes
    const channel = supabase
      .channel('user-presence')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          fetchOnlineUsers();
        }
      )
      .subscribe();

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      clearInterval(heartbeat);
      goOffline();
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, updatePresence, fetchOnlineUsers, goOffline]);

  return {
    onlineUsers,
    isLoading,
    updatePresence,
    setActivity,
    clearActivity,
    goOffline
  };
}
