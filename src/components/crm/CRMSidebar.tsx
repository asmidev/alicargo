import { Home, Package, Box, Truck, DollarSign, Users, Layers, Flag, FileText, AlertTriangle, CheckSquare, ArrowRightLeft, ChevronDown, Settings, LayoutDashboard, Brain, Wallet, Bot, Store, ShoppingCart, LineChart, ShoppingBag } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useTranslation } from 'react-i18next';
import { useUserRole } from '@/hooks/useUserRole';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  chinaOnly?: boolean;
  uzOnly?: boolean;
  requiresManager?: boolean;
  requiresChiefManager?: boolean;
  isSettings?: boolean;
};

type MenuSection = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
};

const menuSections: MenuSection[] = [
  {
    label: 'sidebar_overview',
    icon: LayoutDashboard,
    items: [
      { title: 'dashboard', url: '/crm', icon: Home },
      { title: 'ali_ai', url: '/crm/ali-ai', icon: Bot },
      { title: 'china_dashboard', url: '/crm/china-dashboard', icon: Flag, chinaOnly: true },
      { title: 'tashkent_dashboard', url: '/crm/tashkent-dashboard', icon: Flag, uzOnly: true },
    ]
  },
  {
    label: 'sidebar_operations',
    icon: Package,
    items: [
      { title: 'orders', url: '/crm/products', icon: Package },
      { title: 'boxes', url: '/crm/boxes', icon: Box },
      { title: 'logistics', url: '/crm/shipments', icon: Truck },
      { title: 'movements', url: '/crm/movements', icon: ArrowRightLeft },
    ],
  },
  {
    label: 'sidebar_store',
    icon: Store,
    items: [
      { title: 'store_orders', url: '/crm/store-orders', icon: ShoppingBag },
    ]
  },
  {
    label: 'Analitika',
    icon: LineChart,
    items: [
      { title: 'Umumiy Analitika', url: '/crm/analytics', icon: LineChart },
    ]
  },
  {
    label: 'sidebar_marketplace',
    icon: Store,
    items: [
      { title: 'marketplace_orders', url: '/crm/marketplace/orders', icon: ShoppingCart },
      { title: 'marketplace_listings', url: '/crm/marketplace/listings', icon: Package },
      { title: 'marketplace_analytics', url: '/crm/marketplace/analytics', icon: Brain },
      { title: 'marketplace_admin', url: '/crm/admin/marketplace', icon: Settings, requiresManager: true },
    ]
  },
  {
    label: 'sidebar_work',
    icon: CheckSquare,
    items: [
      { title: 'tasks', url: '/crm/tasks', icon: CheckSquare },
      { title: 'claims', url: '/crm/claims', icon: AlertTriangle },
      { title: 'verification_reports', url: '/crm/verification-reports', icon: FileText, chinaOnly: true },
    ]
  },
  {
    label: 'sidebar_management',
    icon: Settings,
    items: [
      { title: 'finance', url: '/crm/finance', icon: DollarSign },
      { title: 'ai_analytics', url: '/crm/ai-analytics', icon: Brain, requiresManager: true },

      { title: 'investor_dashboard', url: '/crm/investor-dashboard', icon: Wallet },
      { title: 'users', url: '/crm/users', icon: Users, requiresManager: true },
      { title: 'categories', url: '/crm/admin/categories', icon: Layers, requiresChiefManager: true },

      { title: 'settings', url: '/crm/settings', icon: Settings },
    ]
  },
];

export function CRMSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    isOwner,
    isChiefManager,
    isChinaManager,
    isChinaStaff,
    isUzManager,
    isUzStaff,
    isFinanceStaff,
    isMarketplaceManager,
    isInvestor,
    isCourier,
    isSupport,
    canManageUsers,
    canAccessFinance,
    canAccessInvestorReports
  } = useUserRole();

  const collapsed = state === 'collapsed';

  // Determine which sections should be open by default based on current route
  const getDefaultOpenSections = () => {
    const openSections: string[] = [];
    menuSections.forEach(section => {
      if (section.items.some(item =>
        item.url === '/crm' ? location.pathname === item.url : location.pathname.startsWith(item.url)
      )) {
        openSections.push(section.label);
      }
    });
    return openSections.length > 0 ? openSections : ['sidebar_overview'];
  };

  const [openSections, setOpenSections] = useState<string[]>(getDefaultOpenSections);

  const toggleSection = (label: string) => {
    setOpenSections(prev =>
      prev.includes(label)
        ? prev.filter(s => s !== label)
        : [...prev, label]
    );
  };

  const isActive = (path: string) => {
    if (path === '/crm') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  const filterItem = (item: MenuItem): boolean => {
    const url = item.url;

    // Dashboard is always visible to everyone
    if (url === '/crm') return true;

    // Settings always visible
    if (url === '/crm/settings') return true;

    // Rahbar (Owner): Dashboard, Finance, Investor Dashboard, Ali AI
    if (isOwner && !isChiefManager) {
      return ['/crm/finance', '/crm/investor-dashboard', '/crm/ali-ai'].includes(url);
    }

    // Bosh Menejer: everything EXCEPT Finance
    if (isChiefManager) {
      return url !== '/crm/investor-dashboard';
    }

    // Moliya Xodimi: Dashboard + Finance only
    if (isFinanceStaff) {
      return url === '/crm/finance';
    }

    // Investor: Dashboard + Investor Dashboard only
    if (isInvestor) {
      return url === '/crm/investor-dashboard';
    }

    // Kuryer: Dashboard + Tasks only
    if (isCourier) {
      return url === '/crm/tasks';
    }

    // Xitoy Manager: Dashboard, China Dashboard, Boxes, Shipments, Tasks, Verification Reports, Ali AI
    if (isChinaManager) {
      return ['/crm/china-dashboard', '/crm/boxes', '/crm/shipments', '/crm/tasks', '/crm/verification-reports', '/crm/ali-ai'].includes(url);
    }

    // Xitoy Packer: Dashboard, China Dashboard, Boxes, Shipments, Tasks, Verification Reports
    if (isChinaStaff) {
      return ['/crm/china-dashboard', '/crm/boxes', '/crm/shipments', '/crm/tasks', '/crm/verification-reports'].includes(url);
    }

    // Uz Manager: Dashboard, Tashkent Dashboard, Boxes, Shipments, Tasks, Ali AI
    if (isUzManager) {
      return ['/crm/tashkent-dashboard', '/crm/boxes', '/crm/shipments', '/crm/tasks', '/crm/ali-ai'].includes(url);
    }

    // Uz Receiver: Dashboard, Tashkent Dashboard, Boxes, Shipments, Tasks
    if (isUzStaff) {
      return ['/crm/tashkent-dashboard', '/crm/boxes', '/crm/shipments', '/crm/tasks'].includes(url);
    }

    // Manager (Marketplace): Dashboard, Products, Marketplace (all), Shipments, Tasks, Store Orders, Ali AI
    if (isMarketplaceManager) {
      return ['/crm/products', '/crm/shipments', '/crm/tasks', '/crm/store-orders', '/crm/ali-ai'].includes(url) || url.startsWith('/crm/marketplace');
    }

    return false;
  };

  return (
    <Sidebar className={collapsed ? 'w-16' : 'w-64'}>
      <SidebarContent>
        <div className="p-4">
          <div className="flex items-center gap-3">
            <img src="/pwa-192x192.png" alt="AliBrand" className="w-10 h-10 rounded-xl shadow-lg" />
            {!collapsed && (
              <div>
                <h2 className="text-foreground font-bold">AliBrand</h2>
                <p className="text-xs text-muted-foreground">CRM Platform</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1 px-2">
          {menuSections.map(section => {
            const filteredItems = section.items.filter(filterItem);
            if (filteredItems.length === 0) return null;

            const isOpen = openSections.includes(section.label);
            const SectionIcon = section.icon;

            return (
              <div key={section.label}>
                {collapsed ? (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {filteredItems.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <Link
                              to={item.url}
                              className={`flex items-center justify-center transition-all duration-200 ease-out ${isActive(item.url)
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                              title={t(item.title)}
                            >
                              <item.icon className="h-5 w-5" />
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                ) : (
                  <Collapsible open={isOpen} onOpenChange={() => toggleSection(section.label)}>
                    <CollapsibleTrigger className="w-full">
                      <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 transition-colors">
                        <div className="flex items-center gap-2">
                          <SectionIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{t(section.label)}</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {filteredItems.map((item) => (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <Link
                                  to={item.url}
                                  className={`flex items-center gap-3 transition-all duration-200 ease-out ml-2 ${isActive(item.url)
                                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted hover:translate-x-1'
                                    }`}
                                >
                                  <item.icon className="h-5 w-5 transition-transform duration-200" />
                                  <span>{t(item.title)}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            );
          })}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
