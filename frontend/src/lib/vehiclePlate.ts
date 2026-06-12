// Padrão antigo (ex: ABC1234) e padrão Mercosul (ex: ABC1D23) - espelha o backend
// (src/common/validators/vehicle-plate.validator.ts) - seção 4.3
export const VEHICLE_PLATE_REGEX = /^[A-Z]{3}[0-9](?:[A-Z][0-9]{2}|[0-9]{3})$/;

export const VEHICLE_PLATE_MESSAGE =
  'A placa deve seguir o formato antigo (AAA0000) ou Mercosul (AAA0A00).';
