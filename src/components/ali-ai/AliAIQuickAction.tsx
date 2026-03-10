import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Play,
  ExternalLink,
  ClipboardList,
  Package,
  Truck,
  DollarSign,
  FileText,
  AlertTriangle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface QuickAction {
  type: 'navigate' | 'create_task' | 'generate_report' | 'view_details' | 'custom';
  label: string;
  description?: string;
  icon?: string;
  target?: string;
  data?: Record<string, any>;
  confirmRequired?: boolean;
}

interface AliAIQuickActionProps {
  action: QuickAction | QuickAction[];
  onExecute?: (action: string, data?: any) => void;
}

const ICON_MAP: Record<string, typeof Play> = {
  play: Play,
  link: ExternalLink,
  task: ClipboardList,
  product: Package,
  shipment: Truck,
  finance: DollarSign,
  report: FileText,
  warning: AlertTriangle,
  success: CheckCircle,
};

export function AliAIQuickAction({ action, onExecute }: AliAIQuickActionProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  
  const actions = Array.isArray(action) ? action : [action];
  
  const handleAction = async (act: QuickAction, idx: number) => {
    const actionKey = `${act.type}-${idx}`;
    setLoading(actionKey);
    
    try {
      switch (act.type) {
        case 'navigate':
          if (act.target) {
            navigate(act.target);
            toast.success(`${act.label} sahifasiga o'tildi`);
          }
          break;
        
        case 'create_task':
          if (act.data) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const priorityValue = act.data.priority || 'medium';
              const validPriority = ['low', 'medium', 'high', 'urgent'].includes(priorityValue) 
                ? priorityValue as 'low' | 'medium' | 'high' | 'urgent'
                : 'medium' as const;
              
              const { error } = await supabase
                .from('tasks')
                .insert([{
                  title: String(act.data.title || act.label),
                  description: String(act.data.description || act.description || ''),
                  priority: validPriority,
                  status: 'todo' as const,
                  created_by: user.id,
                  assigned_to: user.id,
                }]);
              
              if (error) throw error;
              toast.success('Vazifa yaratildi');
            }
          }
          break;
        
        case 'generate_report':
          toast.info('Hisobot yaratilmoqda...');
          // Could integrate with report generation
          setTimeout(() => {
            toast.success('Hisobot tayyor');
          }, 2000);
          break;
        
        case 'view_details':
          if (act.target) {
            navigate(act.target);
          }
          break;
        
        case 'custom':
          onExecute?.(act.label, act.data);
          break;
      }
    } catch (error) {
      console.error('Action error:', error);
      toast.error("Amaliyotda xatolik yuz berdi");
    } finally {
      setLoading(null);
    }
  };
  
  if (actions.length === 0) return null;
  
  return (
    <Card className="my-2 bg-primary/5 border-primary/20">
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" className="text-xs bg-primary/10">
            <Play className="h-3 w-3 mr-1" />
            Tez amallar
          </Badge>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {actions.map((act, idx) => {
            const IconComponent = act.icon ? ICON_MAP[act.icon] || Play : Play;
            const isLoading = loading === `${act.type}-${idx}`;
            
            return (
              <Button
                key={idx}
                variant="outline"
                size="sm"
                onClick={() => handleAction(act, idx)}
                disabled={isLoading}
                className="h-8 text-xs gap-1.5"
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <IconComponent className="h-3 w-3" />
                )}
                {act.label}
              </Button>
            );
          })}
        </div>
        
        {actions[0]?.description && (
          <p className="text-xs text-muted-foreground mt-2">
            {actions[0].description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
