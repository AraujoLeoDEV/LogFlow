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

// O perfil Conferente tem acesso restrito apenas à tela de Envios
// (confirmação de recebimento), por isso é excluído das demais telas.
const ROLES_EXCEPT_CONFERENTE: Role[] = ['ADMIN', 'COORDENACAO', 'MOTORISTA', 'FINANCEIRO'];

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, roles: ROLES_EXCEPT_CONFERENTE },
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
  {
    label: 'Registro Diário',
    to: '/registro-diario',
    icon: ClipboardList,
    roles: ROLES_EXCEPT_CONFERENTE,
  },
  { label: 'Abastecimentos', to: '/abastecimentos', icon: Fuel, roles: ROLES_EXCEPT_CONFERENTE },
  {
    label: 'Manutenções',
    to: '/manutencoes',
    icon: Wrench,
    roles: ['ADMIN', 'COORDENACAO', 'FINANCEIRO'],
  },
  { label: 'Ocorrências', to: '/ocorrencias', icon: AlertTriangle, roles: ROLES_EXCEPT_CONFERENTE },
  {
    label: 'Envios',
    to: '/envios',
    icon: PackageSearch,
    roles: ['ADMIN', 'COORDENACAO', 'CONFERENTE'],
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
  { label: 'Relatórios', to: '/relatorios', icon: FileText, roles: ROLES_EXCEPT_CONFERENTE },
  {
    label: 'Usuários',
    to: '/usuarios',
    icon: Users,
    roles: ['ADMIN'],
  },
];
