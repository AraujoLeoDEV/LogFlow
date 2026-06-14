import { LogOut, Menu, PackageSearch, Plus, Route, Truck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import logoIcon from '@/assets/logo-icon.png';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { roleLabels } from '@/lib/roles';

import { NotificationsMenu } from './NotificationsMenu';
import { Sidebar } from './Sidebar';

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}

const quickActions = [
  {
    label: 'Novo envio',
    to: '/envios',
    icon: PackageSearch,
    roles: ['ADMIN', 'COORDENACAO'] as const,
  },
  { label: 'Nova viagem', to: '/viagens', icon: Route, roles: undefined },
  {
    label: 'Novo veículo',
    to: '/veiculos',
    icon: Truck,
    roles: ['ADMIN', 'COORDENACAO'] as const,
  },
  {
    label: 'Novo motorista',
    to: '/motoristas',
    icon: UserRound,
    roles: ['ADMIN', 'COORDENACAO'] as const,
  },
];

export function Header() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  const visibleQuickActions = quickActions.filter(
    (action) => !action.roles || hasRole(...action.roles),
  );

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="flex items-center gap-2 px-4 pt-4 text-left">
            <img src={logoIcon} alt="LogFlow" className="size-7 rounded-md" />
            Sistema de Frota
          </SheetTitle>
          <Sidebar onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex-1">
        <h1 className="text-sm font-semibold text-muted-foreground">
          Sistema de Logística e Controle de Frota
        </h1>
      </div>

      {visibleQuickActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" className="gap-1.5" />}>
            <Plus className="size-4" />
            Novo
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              {visibleQuickActions.map((action) => (
                <DropdownMenuItem key={action.to} onClick={() => navigate(action.to)}>
                  <action.icon className="size-4" />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <NotificationsMenu />

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2" />}>
          <Avatar className="size-7">
            <AvatarFallback>{user ? getInitials(user.name) : '?'}</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col items-start gap-0.5">
              <span>{user?.name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {user ? roleLabels[user.role] : ''}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="size-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
