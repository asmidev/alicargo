import { useCollaboration } from '@/contexts/CollaborationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Users, ScrollText, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { TeamChat } from './TeamChat';
import { TeamPresence } from './TeamPresence';
import { ShiftHandoffNotes } from './ShiftHandoffNotes';
import { ActivityFeed } from './ActivityFeed';

export function CollaborationPanel() {
  const { isOpen, setIsOpen } = useCollaboration();
  const isMobile = useIsMobile();
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          {isMobile ? (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: '5%' }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 bg-card rounded-t-2xl shadow-2xl border-t border-border flex flex-col"
              style={{ height: '95vh' }}
            >
              {/* Handle */}
              <div className="flex items-center justify-center pt-2 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <PanelContent onClose={() => setIsOpen(false)} />
            </motion.div>
          ) : (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-[420px] z-50 bg-card border-l border-border shadow-2xl flex flex-col"
            >
              <PanelContent onClose={() => setIsOpen(false)} />
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

function PanelContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">
          {t('collaboration', 'Hamkorlik')}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-4 mt-3 grid grid-cols-4 h-9">
          <TabsTrigger value="chat" className="text-xs gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="team" className="text-xs gap-1">
            <Users className="h-3.5 w-3.5" />
            {t('team', 'Jamoa')}
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs gap-1">
            <ScrollText className="h-3.5 w-3.5" />
            {t('notes', 'Eslatma')}
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-xs gap-1">
            <Activity className="h-3.5 w-3.5" />
            {t('activity', 'Faoliyat')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="flex-1 overflow-auto p-4 mt-0">
          <TeamChat />
        </TabsContent>
        <TabsContent value="team" className="flex-1 overflow-auto p-4 mt-0">
          <TeamPresence />
        </TabsContent>
        <TabsContent value="notes" className="flex-1 overflow-auto p-4 mt-0">
          <ShiftHandoffNotes />
        </TabsContent>
        <TabsContent value="activity" className="flex-1 overflow-auto p-4 mt-0">
          <ActivityFeed />
        </TabsContent>
      </Tabs>
    </>
  );
}
