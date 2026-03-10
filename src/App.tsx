import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { FinanceCurrencyProvider } from "@/contexts/FinanceCurrencyContext";

import '@/i18n/config';

// Loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Phase 1 pages - Lazy loaded (documentation, less frequently used)
const Index = lazy(() => import("./pages/Index"));
const BPMN = lazy(() => import("./pages/BPMN"));
const C4Architecture = lazy(() => import("./pages/C4Architecture"));
const ERD = lazy(() => import("./pages/ERD"));
const Wireframes = lazy(() => import("./pages/Wireframes"));
const SRS = lazy(() => import("./pages/SRS"));
const Phase2Testing = lazy(() => import("./pages/Phase2Testing"));
const UIArchitecture = lazy(() => import("./pages/UIArchitecture"));
const FlowValidation = lazy(() => import("./pages/FlowValidation"));
const PDFExport = lazy(() => import("./pages/PDFExport"));
const SystemArchitecture = lazy(() => import("./pages/SystemArchitecture"));

// Store pages
const StoreLayout = lazy(() => import("./pages/store/StoreLayout"));
const StoreHome = lazy(() => import("./pages/store/Home"));
const StoreCatalog = lazy(() => import("./pages/store/Catalog"));
const StoreProductPage = lazy(() => import("./pages/store/ProductPage"));
const StoreCartPage = lazy(() => import("./pages/store/Cart"));
const StoreCheckout = lazy(() => import("./pages/store/Checkout"));
const StoreOrderSuccess = lazy(() => import("./pages/store/OrderSuccess"));
const StoreAbout = lazy(() => import("./pages/store/About"));
const StoreContact = lazy(() => import("./pages/store/Contact"));
const StoreTrackOrder = lazy(() => import("./pages/store/TrackOrder"));

// Core pages - eager loaded for fast initial load
import NotFound from "./pages/NotFound";
import BoxVerification from "./pages/BoxVerification";
import Auth from "./pages/Auth";
import CRMLayout from "./pages/crm/Layout";
import Dashboard from "./pages/crm/Dashboard";

// CRM pages - Lazy loaded for code splitting
const ChinaDashboard = lazy(() => import("./pages/crm/ChinaDashboard"));
const TashkentDashboard = lazy(() => import("./pages/crm/TashkentDashboard"));
const VerificationReports = lazy(() => import("./pages/crm/VerificationReports"));
const Products = lazy(() => import("./pages/crm/Products"));
const Boxes = lazy(() => import("./pages/crm/Boxes"));
const Shipments = lazy(() => import("./pages/crm/Shipments"));
const ShipmentDetail = lazy(() => import("./pages/crm/ShipmentDetail"));
const Tracking = lazy(() => import("./pages/crm/Tracking"));
const Finance = lazy(() => import("./pages/crm/Finance"));
const Users = lazy(() => import("./pages/crm/Users"));
const Categories = lazy(() => import("./pages/crm/admin/Categories"));
const MarketplaceAdmin = lazy(() => import("./pages/crm/admin/Marketplace"));
const Verification = lazy(() => import("./pages/crm/Verification"));
const MarketplaceOrders = lazy(() => import("./pages/crm/MarketplaceOrders"));
const MarketplaceListings = lazy(() => import("./pages/crm/MarketplaceListings"));
const MarketplaceAnalytics = lazy(() => import("./pages/crm/MarketplaceAnalytics"));

const TelegramSettings = lazy(() => import("./pages/crm/TelegramSettings"));

const Claims = lazy(() => import("./pages/crm/Claims"));
const Inventory = lazy(() => import("./pages/crm/Inventory"));
const Tasks = lazy(() => import("./pages/crm/Tasks"));
const Movements = lazy(() => import("./pages/crm/Movements"));
const AIAnalytics = lazy(() => import("./pages/crm/AIAnalytics"));
const InvestorDashboard = lazy(() => import("./pages/crm/InvestorDashboard"));
const StoreAnalytics = lazy(() => import("./pages/crm/StoreAnalytics"));

const AliAI = lazy(() => import("./pages/crm/AliAI"));
const Settings = lazy(() => import("./pages/crm/Settings"));
const StoreOrders = lazy(() => import("./pages/crm/StoreOrders"));

// Install page
const Install = lazy(() => import("./pages/Install"));
const SystemMap = lazy(() => import("./pages/SystemMap"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FinanceCurrencyProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Store (public, no auth) */}
                    <Route path="/" element={<StoreLayout />}>
                      <Route index element={<StoreHome />} />
                      <Route path="catalog" element={<StoreCatalog />} />
                      <Route path="catalog/:category" element={<StoreCatalog />} />
                      <Route path="product/:id" element={<StoreProductPage />} />
                      <Route path="cart" element={<StoreCartPage />} />
                      <Route path="checkout" element={<StoreCheckout />} />
                      <Route path="order-success/:orderId" element={<StoreOrderSuccess />} />
                      <Route path="about" element={<StoreAbout />} />
                      <Route path="contact" element={<StoreContact />} />
                      <Route path="track" element={<StoreTrackOrder />} />
                    </Route>

                    {/* Legacy Marketplace routes (keep backward compatibility) */}
                    <Route
                      path="/crm/MarketplaceOrders"
                      element={<Navigate to="/crm/marketplace/orders" replace />}
                    />
                    <Route
                      path="/crm/MarketplaceListings"
                      element={<Navigate to="/crm/marketplace/listings" replace />}
                    />
                    <Route
                      path="/crm/MarketplaceAnalytics"
                      element={<Navigate to="/crm/marketplace/analytics" replace />}
                    />

                    {/* Install page */}
                    <Route path="/install" element={<Install />} />

                    {/* Phase 1 Routes - Documentation */}
                    <Route path="/deliverables" element={<Index />} />
                    <Route path="/bpmn" element={<BPMN />} />
                    <Route path="/c4-architecture" element={<C4Architecture />} />
                    <Route path="/erd" element={<ERD />} />
                    <Route path="/wireframes" element={<Wireframes />} />
                    <Route path="/srs" element={<SRS />} />
                    <Route path="/ui-architecture" element={<UIArchitecture />} />
                    <Route path="/pdf-export" element={<PDFExport />} />
                    <Route path="/phase2-testing" element={<Phase2Testing />} />
                    <Route path="/flow-validation" element={<FlowValidation />} />
                    <Route path="/system-architecture" element={<SystemArchitecture />} />

                    {/* Public Box Verification (QR scan landing) */}
                    <Route path="/verify/:boxId" element={<BoxVerification />} />

                    {/* Phase 2 Routes */}
                    <Route path="/auth" element={<Auth />} />
                    {/* Redirect /dashboard to /crm */}
                    <Route path="/dashboard" element={<Navigate to="/crm" replace />} />
                    <Route
                      path="/crm"
                      element={
                        <ProtectedRoute>
                          <CRMLayout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Dashboard />} />
                      <Route path="china-dashboard" element={<ChinaDashboard />} />
                      <Route path="tashkent-dashboard" element={<TashkentDashboard />} />
                      <Route path="verification-reports" element={<VerificationReports />} />
                      <Route path="products" element={<Products />} />
                      <Route path="boxes" element={<Boxes />} />
                      <Route path="verification" element={<Verification />} />
                      <Route path="shipments" element={<Shipments />} />
                      <Route path="shipments/:shipmentId" element={<ShipmentDetail />} />
                      <Route path="tracking" element={<Tracking />} />
                      <Route path="users" element={<Users />} />
                      <Route path="admin/categories" element={<Categories />} />
                      <Route path="admin/marketplace" element={<MarketplaceAdmin />} />
                      <Route path="marketplace/orders" element={<MarketplaceOrders />} />
                      <Route path="marketplace/listings" element={<MarketplaceListings />} />
                      <Route path="marketplace/analytics" element={<MarketplaceAnalytics />} />

                      <Route path="finance" element={<Finance />} />
                      <Route path="telegram-settings" element={<TelegramSettings />} />

                      <Route path="claims" element={<Claims />} />
                      <Route path="inventory" element={<Inventory />} />
                      <Route path="tasks" element={<Tasks />} />
                      <Route path="movements" element={<Movements />} />
                      <Route path="ai-analytics" element={<AIAnalytics />} />
                      <Route path="investor-dashboard" element={<InvestorDashboard />} />
                      <Route path="analytics" element={<StoreAnalytics />} />

                      <Route path="ali-ai" element={<AliAI />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="store-orders" element={<StoreOrders />} />
                    </Route>

                    {/* System Map */}
                    <Route path="/system-map" element={
                      <ProtectedRoute><SystemMap /></ProtectedRoute>
                    } />

                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </ErrorBoundary>
            </BrowserRouter>
          </TooltipProvider>
        </FinanceCurrencyProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
