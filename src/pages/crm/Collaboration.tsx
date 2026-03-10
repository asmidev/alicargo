import { useState } from 'react';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { useTranslation } from 'react-i18next';
import { ActivityFeed, TeamPresence, ShiftHandoffNotes, TeamChat } from '@/components/collaboration';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Users, 
  ClipboardList, 
  MessageSquare
} from 'lucide-react';

export default function Collaboration() {
  const { isLoading: rolesLoading, isChinaManager, isChinaStaff } = useUserRole();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('chat');

  // Determine user's location
  const userLocation = (isChinaManager || isChinaStaff) ? 'china' : 'uzbekistan';

  if (rolesLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-background/95 backdrop-blur shrink-0">
        <h1 className="text-xl font-semibold">{t('collab_title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('collab_subtitle')}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {/* Mobile: Full Tab View */}
        <div className="lg:hidden h-full flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-4 mx-4 mt-3 shrink-0">
              <TabsTrigger value="chat" className="gap-1.5">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">{t('collab_chat')}</span>
              </TabsTrigger>
              <TabsTrigger value="team" className="gap-1.5">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">{t('collab_team')}</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1.5">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">{t('collab_notes')}</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5">
                <Activity className="h-4 w-4" />
                <span className="hidden sm:inline">{t('collab_activity')}</span>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden p-4">
              <TabsContent value="chat" className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <TeamChat />
              </TabsContent>
              <TabsContent value="team" className="h-full m-0 overflow-auto">
                <TeamPresence />
              </TabsContent>
              <TabsContent value="notes" className="h-full m-0 overflow-auto">
                <ShiftHandoffNotes location={userLocation} />
              </TabsContent>
              <TabsContent value="activity" className="h-full m-0 overflow-auto">
                <ActivityFeed />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Desktop: Two Column Layout */}
        <div className="hidden lg:flex h-full">
          {/* Left: Chat (Primary Focus) */}
          <div className="flex-1 border-r p-4 flex flex-col min-w-0">
            <TeamChat />
          </div>

          {/* Right: Sidebar with Team, Notes, Activity */}
          <div className="w-80 xl:w-96 flex flex-col overflow-hidden">
            <Tabs defaultValue="team" className="flex-1 flex flex-col">
              <TabsList className="grid grid-cols-3 mx-4 mt-4 shrink-0">
                <TabsTrigger value="team" className="text-xs">
                  <Users className="h-3.5 w-3.5 mr-1" />
                  {t('collab_team')}
                </TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">
                  <ClipboardList className="h-3.5 w-3.5 mr-1" />
                  {t('collab_notes')}
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">
                  <Activity className="h-3.5 w-3.5 mr-1" />
                  {t('collab_activity')}
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden p-4">
                <TabsContent value="team" className="h-full m-0">
                  <TeamPresence />
                </TabsContent>
                <TabsContent value="notes" className="h-full m-0">
                  <ShiftHandoffNotes location={userLocation} />
                </TabsContent>
                <TabsContent value="activity" className="h-full m-0">
                  <ActivityFeed />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
