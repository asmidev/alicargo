import { Outlet } from 'react-router-dom';
import { StoreHeader } from '@/components/store/StoreHeader';
import { StoreFooter } from '@/components/store/StoreFooter';

export default function StoreLayout() {
  return (
    <div className="store-light min-h-screen flex flex-col bg-background text-foreground">
      <StoreHeader />
      <main className="flex-1 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
      <StoreFooter />
    </div>
  );
}
