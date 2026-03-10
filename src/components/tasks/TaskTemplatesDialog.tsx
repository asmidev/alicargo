import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Play, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TaskTemplate {
  id: string;
  name: string;
  description: string | null;
  title_template: string;
  description_template: string | null;
  default_priority: string | null;
  default_location: string | null;
  default_entity_type: string | null;
  estimated_duration_hours: number | null;
  is_active: boolean;
  created_at: string;
}

interface TaskTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseTemplate: (template: TaskTemplate) => void;
}

export function TaskTemplatesDialog({ open, onOpenChange, onUseTemplate }: TaskTemplatesDialogProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    title_template: '',
    description_template: '',
    default_priority: 'medium',
    default_location: '',
    estimated_duration_hours: 0,
  });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as TaskTemplate[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('task_templates').insert({
        name: newTemplate.name,
        description: newTemplate.description || null,
        title_template: newTemplate.title_template,
        description_template: newTemplate.description_template || null,
        default_priority: newTemplate.default_priority,
        default_location: newTemplate.default_location || null,
        estimated_duration_hours: newTemplate.estimated_duration_hours || null,
        created_by: user?.id!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success(t('template_created'));
      setIsCreating(false);
      setNewTemplate({
        name: '',
        description: '',
        title_template: '',
        description_template: '',
        default_priority: 'medium',
        default_location: '',
        estimated_duration_hours: 0,
      });
    },
    onError: () => {
      toast.error(t('error_creating_template'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('task_templates')
        .update({ is_active: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      toast.success(t('template_deleted'));
    },
  });

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95dvh] sm:max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('task_templates')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            size="sm"
            variant={isCreating ? 'secondary' : 'default'}
            onClick={() => setIsCreating(!isCreating)}
          >
            <Plus className="h-4 w-4 mr-1" />
            {isCreating ? t('cancel') : t('new_template')}
          </Button>
        </div>

        {isCreating && (
          <Card className="border-primary/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t('create_template')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('template_name')}</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder={t('template_name_placeholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('default_priority')}</Label>
                  <Select
                    value={newTemplate.default_priority}
                    onValueChange={(v) => setNewTemplate({ ...newTemplate, default_priority: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('low')}</SelectItem>
                      <SelectItem value="medium">{t('medium')}</SelectItem>
                      <SelectItem value="high">{t('high')}</SelectItem>
                      <SelectItem value="urgent">{t('urgent')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('task_title_template')}</Label>
                <Input
                  value={newTemplate.title_template}
                  onChange={(e) => setNewTemplate({ ...newTemplate, title_template: e.target.value })}
                  placeholder={t('task_title_template_placeholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t('description')}</Label>
                <Textarea
                  value={newTemplate.description_template}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description_template: e.target.value })}
                  rows={2}
                  placeholder={t('task_description_placeholder')}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('default_location')}</Label>
                  <Select
                    value={newTemplate.default_location}
                    onValueChange={(v) => setNewTemplate({ ...newTemplate, default_location: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('select_location')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="china">{t('china')}</SelectItem>
                      <SelectItem value="uzbekistan">{t('uzbekistan')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('estimated_hours')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newTemplate.estimated_duration_hours}
                    onChange={(e) => setNewTemplate({ ...newTemplate, estimated_duration_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  disabled={!newTemplate.name || !newTemplate.title_template || createMutation.isPending}
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  {t('create_template')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>{t('no_templates')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <Card key={template.id} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{template.name}</h4>
                          {template.default_priority && (
                            <Badge variant="secondary" className={`text-xs ${priorityColors[template.default_priority]}`}>
                              {t(template.default_priority)}
                            </Badge>
                          )}
                          {template.default_location && (
                            <Badge variant="outline" className="text-xs">
                              {t(template.default_location)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {template.title_template}
                        </p>
                        {template.description && (
                          <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              // Close dialog first to prevent state conflicts
                              onOpenChange(false);
                              // Use setTimeout to ensure dialog closes before template is applied
                              setTimeout(() => {
                                onUseTemplate(template);
                              }, 100);
                            } catch (error) {
                              console.error('Error using template:', error);
                              toast.error(t('error_using_template') || 'Shablon ishlatishda xatolik');
                            }
                          }}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {t('use')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
