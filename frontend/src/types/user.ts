import type { Role } from './auth';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  unitId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
  unitId?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  unitId?: string | null;
  isActive?: boolean;
}
