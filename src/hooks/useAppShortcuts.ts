import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

interface AppShortcut {
  id: string;
  title: string;
  icon: string;
  description?: string;
  path: string;
}

const APP_SHORTCUTS: AppShortcut[] = [
  {
    id: 'scan-qr',
    title: 'QR Skanerlash',
    icon: 'qr_code_scanner',
    description: 'Quti QR kodini skanerlang',
    path: '/crm/boxes?scan=true',
  },
  {
    id: 'new-task',
    title: 'Yangi vazifa',
    icon: 'add_task',
    description: 'Vazifa yaratish',
    path: '/crm/tasks?new=true',
  },
  {
    id: 'ali-ai',
    title: 'Ali AI',
    icon: 'smart_toy',
    description: 'AI yordamchisi bilan gaplashing',
    path: '/crm/ali-ai',
  },
  {
    id: 'search',
    title: 'Qidirish',
    icon: 'search',
    description: 'Mahsulot yoki quti qidirish',
    path: '/crm/products?search=true',
  },
];

export function useAppShortcuts() {
  const navigate = useNavigate();
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [shortcuts] = useState<AppShortcut[]>(APP_SHORTCUTS);

  // Set up shortcuts on app start
  useEffect(() => {
    if (isNative) {
      // Would use @nicholasng/capacitor-app-shortcuts
      // AppShortcuts.setDynamicShortcuts({
      //   items: shortcuts.map(s => ({
      //     id: s.id,
      //     shortLabel: s.title,
      //     longLabel: s.description,
      //     iconType: 'Default',
      //   })),
      // });
    }
  }, [isNative, shortcuts]);

  // Handle shortcut action
  const handleShortcut = useCallback((shortcutId: string) => {
    const shortcut = shortcuts.find(s => s.id === shortcutId);
    if (shortcut) {
      navigate(shortcut.path);
    }
  }, [shortcuts, navigate]);

  // Listen for shortcut selections (native)
  useEffect(() => {
    if (!isNative) return;

    // Would listen for shortcut events
    // AppShortcuts.addListener('shortcut', (data) => {
    //   handleShortcut(data.shortcutId);
    // });

    // Cleanup
    // return () => AppShortcuts.removeAllListeners();
  }, [isNative, handleShortcut]);

  // Get all shortcuts for rendering in UI
  const getShortcuts = useCallback(() => shortcuts, [shortcuts]);

  // Execute a shortcut by ID
  const executeShortcut = useCallback((id: string) => {
    handleShortcut(id);
  }, [handleShortcut]);

  return {
    shortcuts,
    getShortcuts,
    executeShortcut,
  };
}
