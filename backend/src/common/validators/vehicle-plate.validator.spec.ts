import { IsVehiclePlateConstraint } from './vehicle-plate.validator';

describe('IsVehiclePlateConstraint', () => {
  const constraint = new IsVehiclePlateConstraint();

  it('aceita placas no formato antigo (AAA0000)', () => {
    expect(constraint.validate('ABC1234')).toBe(true);
  });

  it('aceita placas no formato Mercosul (AAA0A00)', () => {
    expect(constraint.validate('ABC1D23')).toBe(true);
  });

  it('rejeita placas com formato inválido', () => {
    expect(constraint.validate('AB1234')).toBe(false);
    expect(constraint.validate('ABCD123')).toBe(false);
    expect(constraint.validate('abc1234')).toBe(false);
    expect(constraint.validate('')).toBe(false);
  });

  it('rejeita valores que não são string', () => {
    expect(constraint.validate(1234)).toBe(false);
    expect(constraint.validate(null)).toBe(false);
    expect(constraint.validate(undefined)).toBe(false);
  });
});
