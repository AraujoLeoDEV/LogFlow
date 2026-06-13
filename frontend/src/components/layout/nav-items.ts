import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FileText,
  Fuel,
  LayoutDashboard,
  type LucideIcon,
  Map,
  PackageSearch,
  Route,
  Target,
  Truck,
  UserRound,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

import type { Role } from '@/types/auth';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  roles?: Role[];
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  {
    label: 'Motoristas',
    to: '/motoristas',
    icon: UserRound,
    roles: ['ADMIN', 'COORDENACAO'],
  },
  {
    label: 'Veículos',
    to: '/veiculos',
    icon: Truck,
    roles: ['ADMIN', 'COORDENACAO'],
  },
  {
    label: 'Rotas',
    to: '/rotas',
    icon: Map,
    roles: ['ADMIN', 'COORDENACAO'],
  },
  { label: 'Registro Diário', to: '/registro-diario', icon: ClipboardList },
  { label: 'Viagens', to: '/viagens', icon: Route },
  { label: 'Abastecimentos', to: '/abastecimentos', icon: Fuel },
  {
    label: 'Manutenções',
    to: '/manutencoes',
    icon: Wrench,
    roles: ['ADMIN', 'COORDENACAO', 'FINANCEIRO'],
  },
  { label: 'Ocorrências', to: '/ocorrencias', icon: AlertTriangle },
  {
    label: 'Envios',
    to: '/envios',
    icon: PackageSearch,
    roles: ['ADMIN', 'COORDENACAO'],
  },
  {
    label: 'Unidades',
    to: '/unidades',
    icon: Building2,
    roles: ['ADMIN', 'COORDENACAO'],
  },
  {
    label: 'Financeiro',
    to: '/financeiro',
    icon: Wallet,
    roles: ['ADMIN', 'COORDENACAO', 'FINANCEIRO'],
  },
  {
    label: 'Metas',
    to: '/metas',
    icon: Target,
    roles: ['ADMIN', 'COORDENACAO'],
  },
  { label: 'Relatórios', to: '/relatorios', icon: FileText },
  {
    label: 'Usuários',
    to: '/usuarios',
    icon: Users,
    roles: ['ADMIN'],
  },
];
