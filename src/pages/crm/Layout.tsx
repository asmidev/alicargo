import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar';
import { CRMSidebar } from '@/components/crm/CRMSidebar';
import { CRMHeader } from '@/components/crm/CRMHeader';
import { 
  OfflineBanner, 
  InstallPrompt,
  AnimatedBottomNav,
  PageTransition,
  GestureNavigation
} from '@/components/mobile';
import { useIsMobile } from '@/hooks/use-mobile';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { CollaborationProvider } from '@/contexts/CollaborationContext';
import { CollaborationPanel } from '@/components/collaboration/CollaborationPanel';

export default function CRMLayout() {
  const isMobile = useIsMobile();
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [showMobileComponents, setShowMobileComponents] = useState(false);
  
  // Delay layout initialization to prevent race conditions on mobile
  useEffect(() => {
    // Mark layout as ready after a brief stabilization period
    const readyTimer = setTimeout(() => {
      setIsLayoutReady(true);
    }, 300);

    // Delay mobile-specific components to prevent initial render blocking
    const mobileTimer = setTimeout(() => {
      setShowMobileComponents(true);
    }, 1000);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(mobileTimer);
    };
  }, []);

  return (
    <CollaborationProvider>
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <OfflineBanner />
        <CRMSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Only show header on desktop - mobile uses MobileHeader per page */}
          {!isMobile && <CRMHeader />}
          <ErrorBoundary>
            <GestureNavigation>
              <main 
                className="flex-1 overflow-x-hidden mobile-content-spacing"
                style={{ 
                  padding: isMobile ? '0' : '24px',
                }}
              >
                <PageTransition>
                  <div style={{ 
                    padding: isMobile ? '12px 12px calc(env(safe-area-inset-bottom) + 5rem) 12px' : '0',
                  }}>
                    <ErrorBoundary>
                      <Outlet />
                    </ErrorBoundary>
                  </div>
                </PageTransition>
              </main>
            </GestureNavigation>
          </ErrorBoundary>
        </div>
        {/* Delay mobile components to prevent blocking initial render */}
        {showMobileComponents && <AnimatedBottomNav />}
        {showMobileComponents && <InstallPrompt />}
        <CollaborationPanel />
      </div>
    </SidebarProvider>
    </CollaborationProvider>
  );
}
