import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, Star, AlertTriangle, Loader2 } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface TrackCode {
  id: string;
  track_code: string;
  is_primary: boolean;
  source: string;
  created_at: string;
  notes?: string;
}

interface TrackCodesManagerProps {
  boxId?: string;
  trackCodes?: TrackCode[];
  localMode?: boolean;
  localTrackCodes?: string[];
  onLocalAdd?: (code: string) => void;
  onLocalRemove?: (code: string) => void;
  pendingValue?: string;
  onPendingChange?: (value: string) => void;
  compact?: boolean;
}

export function TrackCodesManager({
  boxId,
  trackCodes: externalTrackCodes,
  localMode = false,
  localTrackCodes = [],
  onLocalAdd,
  onLocalRemove,
  pendingValue,
  onPendingChange,
  compact = false,
}: TrackCodesManagerProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [internalTrackCode, setInternalTrackCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  const newTrackCode = localMode && pendingValue !== undefined ? pendingValue : internalTrackCode;
  const setNewTrackCode = localMode && onPendingChange ? onPendingChange : setInternalTrackCode;

  const { data: fetchedTrackCodes, isLoading } = useQuery({
    queryKey: ['box-track-codes', boxId],
    queryFn: async () => {
      if (!boxId || localMode) return [];
      const { data, error } = await supabase
        .from('box_track_codes')
        .select('*')
        .eq('box_id', boxId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as TrackCode[];
    },
    enabled: !!boxId && !localMode,
  });

  const trackCodes = externalTrackCodes || fetchedTrackCodes || [];

  const { data: trackCodeUsage } = useQuery({
    queryKey: ['track-code-usage', newTrackCode],
    queryFn: async () => {
      if (!newTrackCode.trim()) return null;
      const { data, error } = await supabase
        .from('box_track_codes')
        .select('box_id, track_code, boxes:box_id(box_number)')
        .ilike('track_code', newTrackCode.trim())
        .neq('box_id', boxId || '');
      if (error) throw error;
      return data;
    },
    enabled: newTrackCode.trim().length > 3 && !localMode,
  });

  const addTrackCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      if (!boxId) throw new Error('Box ID kerak');
      const hasPrimary = trackCodes.some(tc => tc.is_primary);
      const { data, error } = await supabase
        .from('box_track_codes')
        .insert({
          box_id: boxId,
          track_code: code.trim(),
          source: 'manual',
          is_primary: !hasPrimary,
        })
        .select()
        .single();
      if (error) throw error;
      if (!hasPrimary) {
        await supabase.from('boxes').update({ store_number: code.trim() }).eq('id', boxId);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['box-track-codes', boxId] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      setNewTrackCode('');
      setIsAdding(false);
      toast({ title: t('tc_added') });
    },
    onError: (error: any) => {
      toast({ title: t('toast_error'), description: error.message, variant: 'destructive' });
    },
  });

  const removeTrackCodeMutation = useMutation({
    mutationFn: async (trackCodeId: string) => {
      const trackCode = trackCodes.find(tc => tc.id === trackCodeId);
      const { error } = await supabase.from('box_track_codes').delete().eq('id', trackCodeId);
      if (error) throw error;
      if (trackCode?.is_primary && trackCodes.length > 1) {
        const nextPrimary = trackCodes.find(tc => tc.id !== trackCodeId);
        if (nextPrimary) {
          await supabase.from('box_track_codes').update({ is_primary: true }).eq('id', nextPrimary.id);
          await supabase.from('boxes').update({ store_number: nextPrimary.track_code }).eq('id', boxId);
        }
      }
      if (trackCodes.length <= 1) {
        await supabase.from('boxes').update({ store_number: null }).eq('id', boxId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['box-track-codes', boxId] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      toast({ title: t('tc_removed') });
    },
    onError: (error: any) => {
      toast({ title: t('toast_error'), description: error.message, variant: 'destructive' });
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (trackCodeId: string) => {
      await supabase.from('box_track_codes').update({ is_primary: false }).eq('box_id', boxId);
      const { error } = await supabase.from('box_track_codes').update({ is_primary: true }).eq('id', trackCodeId);
      if (error) throw error;
      const trackCode = trackCodes.find(tc => tc.id === trackCodeId);
      if (trackCode) {
        await supabase.from('boxes').update({ store_number: trackCode.track_code }).eq('id', boxId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['box-track-codes', boxId] });
      queryClient.invalidateQueries({ queryKey: ['boxes'] });
      toast({ title: t('tc_primary_set') });
    },
    onError: (error: any) => {
      toast({ title: t('toast_error'), description: error.message, variant: 'destructive' });
    },
  });

  const handleAdd = () => {
    if (!newTrackCode.trim()) return;
    if (localMode && onLocalAdd) {
      onLocalAdd(newTrackCode.trim());
      setNewTrackCode('');
      setIsAdding(false);
    } else {
      addTrackCodeMutation.mutate(newTrackCode);
    }
  };

  const handleRemove = (trackCodeOrId: string) => {
    if (localMode && onLocalRemove) {
      onLocalRemove(trackCodeOrId);
    } else {
      removeTrackCodeMutation.mutate(trackCodeOrId);
    }
  };

  // Local mode
  if (localMode) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('tc_title')}</label>
        {localTrackCodes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {localTrackCodes.map((code, idx) => (
              <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                <span className="text-xs">🏷️ {code}</span>
                <button type="button" onClick={() => handleRemove(code)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            placeholder={t('tc_new_track')}
            value={newTrackCode}
            onChange={(e) => setNewTrackCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            className="flex-1 min-h-[40px]"
          />
          <Button type="button" size="sm" onClick={handleAdd} disabled={!newTrackCode.trim()} className="min-h-[40px]">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Compact view
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {trackCodes.slice(0, 2).map((tc) => (
          <Badge key={tc.id} variant={tc.is_primary ? "default" : "secondary"} className="text-[10px]">
            {tc.is_primary && <Star className="h-2.5 w-2.5 mr-0.5 fill-current" />}
            {tc.track_code}
          </Badge>
        ))}
        {trackCodes.length > 2 && (
          <Badge variant="outline" className="text-[10px]">+{trackCodes.length - 2}</Badge>
        )}
        {trackCodes.length === 0 && !isLoading && (
          <span className="text-xs text-muted-foreground">{t('tc_no_track')}</span>
        )}
      </div>
    );
  }

  // Full management view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          {t('tc_title')} {trackCodes.length > 0 && t('tc_count', { count: trackCodes.length })}
        </label>
      </div>
      
      {isLoading ? (
        <LoadingSkeleton count={2} compact />
      ) : trackCodes.length > 0 ? (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {trackCodes.map((tc) => (
            <div
              key={tc.id}
              className={cn(
                "flex items-center justify-between p-2 rounded-lg",
                tc.is_primary ? "bg-primary/10 border border-primary/20" : "bg-muted"
              )}
            >
              <div className="flex items-center gap-2">
                {tc.is_primary ? (
                  <Star className="h-4 w-4 text-primary fill-primary" />
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button onClick={() => setPrimaryMutation.mutate(tc.id)} className="text-muted-foreground hover:text-primary transition-colors">
                          <Star className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t('tc_make_primary')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span className="text-sm font-medium">{tc.track_code}</span>
                {tc.is_primary && (
                  <Badge variant="secondary" className="text-[10px]">{t('tc_primary')}</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemove(tc.id)}
                disabled={removeTrackCodeMutation.isPending}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('tc_no_codes')}</p>
      )}
      
      {isAdding ? (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder={t('tc_enter_track')}
              value={newTrackCode}
              onChange={(e) => setNewTrackCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
                if (e.key === 'Escape') { setIsAdding(false); setNewTrackCode(''); }
              }}
              autoFocus
              className="flex-1 min-h-[40px]"
            />
            <Button size="sm" onClick={handleAdd} disabled={!newTrackCode.trim() || addTrackCodeMutation.isPending} className="min-h-[40px]">
              {addTrackCodeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewTrackCode(''); }} className="min-h-[40px]">
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {trackCodeUsage && trackCodeUsage.length > 0 && (
            <div className="flex items-start gap-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-medium">{t('tc_exists_warning')}</p>
                <ul className="mt-1 space-y-0.5">
                  {trackCodeUsage.slice(0, 3).map((usage: any) => (
                    <li key={usage.box_id}>• {usage.boxes?.box_number || usage.box_id}</li>
                  ))}
                  {trackCodeUsage.length > 3 && (
                    <li>• {t('tc_and_more', { count: trackCodeUsage.length - 3 })}</li>
                  )}
                </ul>
                <p className="mt-1 italic">{t('tc_can_add')}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          {t('tc_add')}
        </Button>
      )}
    </div>
  );
}
