import { motion } from 'framer-motion';
import { 
  QrCode, 
  Plus, 
  MessageSquare, 
  Search,
  Package,
  Truck,
  ClipboardList,
  BarChart3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppShortcuts } from '@/hooks/useAppShortcuts';
import { useNativeFeatures } from '@/hooks/useNativeFeatures';
import { BottomSheet } from '@/components/mobile/sheets/BottomSheet';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface QuickActionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'scan-qr': QrCode,
  'new-task': Plus,
  'ali-ai': MessageSquare,
  'search': Search,
};

const additionalActions = [
  {
    id: 'view-boxes',
    icon: Package,
    title: 'Qutilar',
    path: '/crm/boxes',
  },
  {
    id: 'view-shipments',
    icon: Truck,
    title: 'Jo\'natmalar',
    path: '/crm/shipments',
  },
  {
    id: 'view-tasks',
    icon: ClipboardList,
    title: 'Vazifalar',
    path: '/crm/tasks',
  },
  {
    id: 'view-analytics',
    icon: BarChart3,
    title: 'Tahlillar',
    path: '/crm/ai-analytics',
  },
];

export function QuickActionsSheet({ isOpen, onClose }: QuickActionsSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { shortcuts } = useAppShortcuts();
  const { triggerHaptic } = useNativeFeatures();

  const handleAction = async (path: string) => {
    await triggerHaptic('light');
    onClose();
    setTimeout(() => navigate(path), 150);
  };

  return (
    <BottomSheet open={isOpen} onOpenChange={(open) => !open && onClose()} snapPoints={[60]}>
      <div className="px-4 pb-8">
        <h2 className="text-lg font-semibold mb-4">
          {t('quickActions.title', 'Tezkor amallar')}
        </h2>

        {/* Primary shortcuts */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {shortcuts.map((shortcut, index) => {
            const Icon = iconMap[shortcut.id] || QrCode;
            
            return (
              <motion.button
                key={shortcut.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleAction(shortcut.path)}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4",
                  "bg-primary/10 rounded-2xl",
                  "active:scale-95 transition-transform"
                )}
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-medium text-center leading-tight">
                  {shortcut.title}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">
            {t('quickActions.goTo', 'Sahifaga o\'tish')}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Additional actions */}
        <div className="space-y-2">
          {additionalActions.map((action, index) => {
            const Icon = action.icon;
            
            return (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.05 }}
                onClick={() => handleAction(action.path)}
                className={cn(
                  "w-full flex items-center gap-4 p-3",
                  "bg-muted/30 hover:bg-muted/50 rounded-xl",
                  "active:scale-[0.98] transition-all"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <span className="font-medium text-sm">{action.title}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}
