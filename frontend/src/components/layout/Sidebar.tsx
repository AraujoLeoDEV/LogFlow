import { motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

import { navItems } from './nav-items';

interface SidebarProps {
  className?: string;
  onNavigate?: () => void;
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();

  const visibleItems = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <nav className={cn('relative flex flex-col gap-1 p-3', className)}>
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={onNavigate}
            className={cn(
              'group relative flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'text-sidebar-primary-foreground'
                : 'text-sidebar-foreground/65 hover:text-sidebar-foreground',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="sidebar-active-pill"
                className="absolute inset-0 rounded-xl bg-[linear-gradient(135deg,var(--chart-1),var(--chart-3))] shadow-[0_4px_16px_-2px_var(--glow-primary)]"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full transition-colors',
                !isActive && 'group-hover:bg-sidebar-accent/60',
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <span className="relative z-10">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
