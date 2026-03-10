import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  Check, 
  Smartphone, 
  Monitor, 
  Share, 
  Plus,
  MoreVertical,
  Chrome,
  Apple
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { usePlatform } from '@/hooks/usePlatform';

export function InstallCard() {
  const { t } = useTranslation();
  const { isInstallable, isInstalled, isIOS, promptInstall, isDesktop, browserName } = usePWAInstall();
  const { isPWA } = usePlatform();

  const handleInstall = async () => {
    await promptInstall();
  };

  // Already installed state
  if (isInstalled || isPWA) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
              <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('install.appInstalled', 'App Installed')}</CardTitle>
              <CardDescription>
                {t('install.installedDescription', 'AliBrand CRM is installed on this device')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <Check className="h-3 w-3 mr-1" />
            {t('install.runningAsApp', 'Running as installed app')}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Android/Chrome - Direct install available
  if (isInstallable && !isIOS) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              {isDesktop ? <Monitor className="h-5 w-5 text-primary" /> : <Smartphone className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <CardTitle className="text-lg">{t('install.installApp', 'Install App')}</CardTitle>
              <CardDescription>
                {isDesktop 
                  ? t('install.desktopDescription', 'Install AliBrand CRM on your computer for quick access')
                  : t('install.mobileDescription', 'Install AliBrand CRM on your device for quick access')
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleInstall} className="w-full gap-2">
            <Download className="h-4 w-4" />
            {t('install.installNow', 'Install Now')}
          </Button>
          
          {isDesktop && (
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">{t('install.alternativeMethod', 'Or install from browser menu:')}</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>{t('install.desktopStep1', 'Click the install icon in the address bar')}</li>
                <li>{t('install.desktopStep2', 'Or click ⋮ menu → "Install AliBrand CRM"')}</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // iOS - Manual instructions
  if (isIOS) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <Apple className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('install.installOnIOS', 'Install on iPhone')}</CardTitle>
              <CardDescription>
                {t('install.iosDescription', 'Add AliBrand CRM to your home screen')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">1</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t('install.iosStep1Title', 'Tap Share button')}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {t('install.iosStep1Desc', 'Find the')} <Share className="h-3 w-3" /> {t('install.iosStep1Desc2', 'icon at the bottom')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">2</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t('install.iosStep2Title', 'Scroll and tap "Add to Home Screen"')}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {t('install.iosStep2Desc', 'Look for')} <Plus className="h-3 w-3" /> {t('install.iosStep2Desc2', 'Add to Home Screen')}
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">3</div>
              <div className="flex-1">
                <p className="text-sm font-medium">{t('install.iosStep3Title', 'Tap "Add"')}</p>
                <p className="text-xs text-muted-foreground">{t('install.iosStep3Desc', 'Confirm to add the app to your home screen')}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Desktop without install prompt (unsupported browser or already dismissed)
  if (isDesktop) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-full bg-muted">
              <Monitor className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">{t('install.desktopInstall', 'Desktop Installation')}</CardTitle>
              <CardDescription>
                {t('install.desktopBrowserSupport', 'Use Chrome or Edge for best experience')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Chrome className="h-5 w-5" />
              <div>
                <p className="font-medium">Chrome / Edge</p>
                <p className="text-xs text-muted-foreground">
                  {t('install.chromeInstructions', 'Click ⋮ menu → "Install AliBrand CRM" or look for install icon in address bar')}
                </p>
              </div>
            </div>
            
            {browserName && !['Chrome', 'Edge'].includes(browserName) && (
              <p className="text-xs text-muted-foreground">
                {t('install.currentBrowser', 'Current browser:')} {browserName}. {t('install.switchBrowser', 'Switch to Chrome or Edge for installation.')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback - mobile browser without install support
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-muted">
            <Smartphone className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-lg">{t('install.installApp', 'Install App')}</CardTitle>
            <CardDescription>
              {t('install.openInBrowser', 'Open in Chrome or Safari to install')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t('install.browserNotSupported', 'Your current browser may not support app installation. Try opening this page in Chrome (Android) or Safari (iPhone).')}
        </p>
      </CardContent>
    </Card>
  );
}
