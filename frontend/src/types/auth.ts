export type Role = 'ADMIN' | 'COORDENACAO' | 'MOTORISTA' | 'FINANCEIRO';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}
