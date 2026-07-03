import { Outlet } from 'react-router-dom';

import logoIcon from '@/assets/logo-icon.png';
import { ChatWidget } from '@/components/chat/ChatWidget';

import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block">
        <div className="flex h-14 items-center justify-center gap-2 border-b border-sidebar-border px-4">
          <img src={logoIcon} alt="LogFlow" className="size-7 rounded-md" />
          <span className="text-base font-semibold text-sidebar-primary">LogFlow</span>
        </div>
        <Sidebar />
      </aside>
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
      <ChatWidget />
    </div>
  );
}
