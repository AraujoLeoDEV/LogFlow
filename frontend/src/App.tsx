import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { DailyLogsPage } from '@/pages/DailyLogsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { DriversPage } from '@/pages/DriversPage';
import { FinancePage } from '@/pages/FinancePage';
import { FuelPage } from '@/pages/FuelPage';
import { GoalsPage } from '@/pages/GoalsPage';
import { IncidentsPage } from '@/pages/IncidentsPage';
import { LoginPage } from '@/pages/LoginPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { RoutesPage } from '@/pages/RoutesPage';
import { ShipmentsPage } from '@/pages/ShipmentsPage';
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
  '/abastecimentos': <FuelPage />,
  '/manutencoes': <MaintenancePage />,
  '/ocorrencias': <IncidentsPage />,
  '/envios': <ShipmentsPage />,
  '/financeiro': <FinancePage />,
  '/metas': <GoalsPage />,
  '/relatorios': <ReportsPage />,
};

function RootRoute() {
  const { hasRole } = useAuth();

  if (hasRole('CONFERENTE')) {
    return <Navigate to="/envios" replace />;
  }

  return <DashboardPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<RootRoute />} />
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
