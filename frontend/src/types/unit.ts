export interface Unit {
  id: string;
  name: string;
  address: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitPayload {
  name: string;
  address: string;
  active?: boolean;
}

export type UpdateUnitPayload = Partial<CreateUnitPayload>;
