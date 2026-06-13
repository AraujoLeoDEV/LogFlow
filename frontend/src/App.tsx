import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { DailyLogsPage } from '@/pages/DailyLogsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DriversPage } from '@/pages/DriversPage';
import { LoginPage } from '@/pages/LoginPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { UnitsPage } from '@/pages/UnitsPage';
import { UsersPage } from '@/pages/UsersPage';
import { VehiclesPage } from '@/pages/VehiclesPage';

import { navItems } from './components/layout/nav-items';

const PAGES_BY_PATH: Record<string, ReactNode> = {
  '/usuarios': <UsersPage />,
  '/unidades': <UnitsPage />,
  '/rotas': <RoutesPage />,
  '/veiculos': <VehiclesPage />,
  '/motoristas': <DriversPage />,
  '/registro-diario': <DailyLogsPage />,
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                {navItems
                  .filter((item) => item.to !== '/')
                  .map((item) => (
                    <Route key={item.to} element={<ProtectedRoute roles={item.roles} />}>
                      <Route
                        path={item.to}
                        element={PAGES_BY_PATH[item.to] ?? <PlaceholderPage title={item.label} />}
                      />
                    </Route>
                  ))}
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
