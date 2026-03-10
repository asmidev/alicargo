import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

interface DeepLinkRoute {
  pattern: RegExp;
  handler: (matches: RegExpMatchArray) => string;
}

const DEEP_LINK_ROUTES: DeepLinkRoute[] = [
  // Box verification: alibrand://verify/BOX123 or https://alibrand.app/verify/BOX123
  {
    pattern: /\/verify\/([A-Za-z0-9-]+)/,
    handler: (matches) => `/verify/${matches[1]}`,
  },
  // Box details: alibrand://box/uuid
  {
    pattern: /\/box\/([A-Za-z0-9-]+)/,
    handler: (matches) => `/crm/boxes?id=${matches[1]}`,
  },
  // Product details: alibrand://product/uuid
  {
    pattern: /\/product\/([A-Za-z0-9-]+)/,
    handler: (matches) => `/crm/products?id=${matches[1]}`,
  },
  // Task details: alibrand://task/uuid
  {
    pattern: /\/task\/([A-Za-z0-9-]+)/,
    handler: (matches) => `/crm/tasks?id=${matches[1]}`,
  },
  // Shipment tracking: alibrand://shipment/uuid
  {
    pattern: /\/shipment\/([A-Za-z0-9-]+)/,
    handler: (matches) => `/crm/shipments/${matches[1]}`,
  },
  // Ali AI chat: alibrand://ali-ai
  {
    pattern: /\/ali-ai/,
    handler: () => '/crm/ali-ai',
  },
  // Dashboard: alibrand://dashboard
  {
    pattern: /\/dashboard/,
    handler: () => '/crm',
  },
];

export function useDeepLinking() {
  const navigate = useNavigate();
  const location = useLocation();
  const [lastDeepLink, setLastDeepLink] = useState<string | null>(null);
  const [isNative] = useState(Capacitor.isNativePlatform());

  // Parse and handle a deep link URL
  const handleDeepLink = useCallback((url: string) => {
    console.log('Handling deep link:', url);
    setLastDeepLink(url);

    // Extract path from URL
    let path: string;
    try {
      const urlObj = new URL(url);
      path = urlObj.pathname + urlObj.search;
    } catch {
      // If not a valid URL, treat as path directly
      path = url.startsWith('/') ? url : `/${url}`;
    }

    // Find matching route
    for (const route of DEEP_LINK_ROUTES) {
      const matches = path.match(route.pattern);
      if (matches) {
        const targetPath = route.handler(matches);
        console.log('Deep link matched, navigating to:', targetPath);
        navigate(targetPath);
        return true;
      }
    }

    // No match found, try navigating directly
    if (path.startsWith('/')) {
      navigate(path);
      return true;
    }

    console.warn('No matching route for deep link:', url);
    return false;
  }, [navigate]);

  // Listen for deep links on native
  useEffect(() => {
    if (!isNative) return;

    // Would use App plugin from @capacitor/app
    // App.addListener('appUrlOpen', (event) => {
    //   handleDeepLink(event.url);
    // });

    // Cleanup
    // return () => App.removeAllListeners();
  }, [isNative, handleDeepLink]);

  // Handle web deep links (when app loads with a path)
  useEffect(() => {
    // Check if we landed on the app with a deep link path
    const params = new URLSearchParams(location.search);
    const deepLink = params.get('deeplink');
    
    if (deepLink) {
      handleDeepLink(decodeURIComponent(deepLink));
    }
  }, []);

  // Generate a deep link URL
  const createDeepLink = useCallback((
    type: 'box' | 'product' | 'task' | 'shipment' | 'verify' | 'ali-ai' | 'dashboard',
    id?: string
  ): string => {
    const baseUrl = isNative ? 'alibrand://' : window.location.origin;
    
    switch (type) {
      case 'box':
        return `${baseUrl}/box/${id}`;
      case 'product':
        return `${baseUrl}/product/${id}`;
      case 'task':
        return `${baseUrl}/task/${id}`;
      case 'shipment':
        return `${baseUrl}/shipment/${id}`;
      case 'verify':
        return `${baseUrl}/verify/${id}`;
      case 'ali-ai':
        return `${baseUrl}/ali-ai`;
      case 'dashboard':
        return `${baseUrl}/dashboard`;
      default:
        return baseUrl;
    }
  }, [isNative]);

  // Share a deep link
  const shareDeepLink = useCallback(async (
    type: 'box' | 'product' | 'task' | 'shipment' | 'verify',
    id: string,
    title: string
  ): Promise<boolean> => {
    const url = createDeepLink(type, id);
    
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url,
        });
        return true;
      } else {
        await navigator.clipboard.writeText(url);
        return true;
      }
    } catch (error) {
      console.error('Failed to share deep link:', error);
      return false;
    }
  }, [createDeepLink]);

  return {
    handleDeepLink,
    createDeepLink,
    shareDeepLink,
    lastDeepLink,
  };
}
