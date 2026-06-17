export type Role = 'ADMIN' | 'COORDENACAO' | 'MOTORISTA' | 'FINANCEIRO' | 'CONFERENTE';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
