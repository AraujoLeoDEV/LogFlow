import type { Role } from '@/types/auth';

export const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrador',
  COORDENACAO: 'Coordenação',
  MOTORISTA: 'Motorista',
  FINANCEIRO: 'Financeiro',
};

export const roleOptions: { value: Role; label: string }[] = Object.entries(roleLabels).map(
  ([value, label]) => ({ value: value as Role, label }),
);
