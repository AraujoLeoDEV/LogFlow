export interface Unit {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitPayload {
  name: string;
  address: string;
  phone?: string;
  active?: boolean;
}

export type UpdateUnitPayload = Partial<CreateUnitPayload>;
