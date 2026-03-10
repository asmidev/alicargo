import { useTranslation } from 'react-i18next';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { usePlatform } from '@/hooks/usePlatform';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Smartphone, Check, Share, ArrowDown, Plus, Monitor, Chrome, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function InstallPage() {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isIOS, isDesktop, browserName, promptInstall } = usePWAInstall();
  const { isPWA, isMobileDevice } = usePlatform();

  const handleInstall = async () => {
    await promptInstall();
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.origin + '/install' : '';

  if (isInstalled || isPWA) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle>{t('install.alreadyInstalled', 'App Installed!')}</CardTitle>
            <CardDescription>
              {t('install.alreadyInstalledDesc', 'AliBrand CRM is installed on your device.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <a href="/crm">{t('install.openApp', 'Open App')}</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/10 to-background px-4 py-12 text-center">
        <img 
          src="/pwa-192x192.png" 
          alt="AliBrand" 
          className="w-20 h-20 rounded-2xl mx-auto mb-4 shadow-lg"
        />
        <h1 className="text-2xl font-bold mb-2">AliBrand CRM</h1>
        <p className="text-muted-foreground">
          {t('install.subtitle', 'Logistics & Inventory Management System')}
        </p>
      </div>

      {/* Benefits */}
      <div className="px-4 py-8 space-y-4 max-w-md mx-auto">
        <h2 className="font-semibold text-lg mb-4">
          {t('install.benefits', 'App Benefits')}
        </h2>
        
        <div className="space-y-3">
          {[
            { icon: Smartphone, text: t('install.benefit1', 'Works like a native app on your device') },
            { icon: Download, text: t('install.benefit2', 'Works offline with cached data') },
            { icon: Check, text: t('install.benefit3', 'Faster loading and better performance') },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm">{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Install Instructions */}
      <div className="px-4 py-8 border-t border-border">
        <div className="max-w-md mx-auto">
          <h2 className="font-semibold text-lg mb-4">
            {t('install.howTo', 'How to Install')}
          </h2>

          {isInstallable && !isIOS ? (
            // Chrome/Android/Desktop - Direct install
            <div className="space-y-6">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground text-sm">
                  {isDesktop 
                    ? t('install.desktopClickBelow', 'Click the button below to install on your computer')
                    : t('install.clickBelow', 'Tap the button below to install')
                  }
                </p>
                <Button size="lg" onClick={handleInstall} className="w-full gap-2">
                  <Download className="w-5 h-5" />
                  {t('install.installNow', 'Install Now')}
                </Button>
              </div>

              {isDesktop && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">{t('install.alternativeMethod', 'Alternative method:')}</p>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Chrome className="w-5 h-5 mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p>{t('install.desktopAlt1', 'Look for the install icon in your browser\'s address bar, or click the menu (⋮) and select "Install AliBrand CRM"')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : isIOS ? (
            // iOS Safari - Manual steps
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                {t('install.iosSteps', 'Follow these steps in Safari browser:')}
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                    1
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Share className="w-4 h-4" />
                      {t('install.tapShare', 'Tap the Share button')}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('install.shareLocation', 'Located at the bottom of your browser')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <ArrowDown className="w-4 h-4" />
                      {t('install.scrollDown', 'Scroll down the menu')}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('install.scrollDownDesc', 'Swipe the share menu upward')}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      {t('install.addToHome', 'Select "Add to Home Screen"')}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('install.addToHomeDesc', 'This adds the app to your home screen')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : isDesktop && !isInstallable ? (
            // Desktop without install prompt available
            <div className="space-y-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
                <Monitor className="w-6 h-6 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">{t('install.desktopInstructions', 'Desktop Installation')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {browserName === 'Chrome' || browserName === 'Edge'
                      ? t('install.chromeBrowserMenu', 'Click the browser menu (⋮) and select "Install AliBrand CRM" or look for the install icon in the address bar.')
                      : t('install.switchToChrome', 'For the best experience, open this page in Chrome or Edge browser to install the app.')
                    }
                  </p>
                </div>
              </div>

              {/* QR Code for mobile install */}
              <div className="border-t pt-6">
                <p className="text-sm font-medium mb-4 text-center">{t('install.orInstallOnMobile', 'Or install on your phone')}</p>
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-xl shadow-sm">
                    <QRCodeSVG value={currentUrl} size={140} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('install.scanQR', 'Scan this QR code with your phone to install the mobile app')}
                  </p>
                </div>
              </div>

              <div className="text-center">
                <Button variant="outline" asChild>
                  <a href="/crm" className="gap-2">
                    <ExternalLink className="w-4 h-4" />
                    {t('install.continueInBrowser', 'Continue in Browser')}
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            // Mobile unsupported browser
            <div className="text-center space-y-4">
              <p className="text-muted-foreground text-sm">
                {isMobileDevice 
                  ? t('install.openInBrowser', 'Please open in Chrome or Safari browser')
                  : t('install.mobileOnly', 'Open on your phone to install the app')
                }
              </p>
              <Button variant="outline" asChild>
                <a href="/crm">{t('install.continueInBrowser', 'Continue in Browser')}</a>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-8 text-center text-xs text-muted-foreground">
        <p>© 2024 AliBrand CRM</p>
        <p className="mt-1">{t('install.version', 'Version')} 1.0.0</p>
      </div>
    </div>
  );
}
