import { Outlet, useLocation } from 'react-router-dom';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/pipelines': 'Pipelines',
  '/create-pipeline': 'Create Pipeline',
  '/data-catalog': 'Data Catalog',
  '/quarantine': 'Quarantine',
  '/settings': 'Settings',
};

export function AppLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'Data Pipeline Platform';

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader title={title} />
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
