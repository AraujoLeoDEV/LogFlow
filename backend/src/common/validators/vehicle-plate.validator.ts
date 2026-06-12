import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Padrão antigo (ex: ABC1234) e padrão Mercosul (ex: ABC1D23) - seção 4.3
const PLATE_REGEX = /^[A-Z]{3}[0-9](?:[A-Z][0-9]{2}|[0-9]{3})$/;

@ValidatorConstraint({ name: 'isVehiclePlate' })
export class IsVehiclePlateConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return typeof value === 'string' && PLATE_REGEX.test(value);
  }

  defaultMessage(): string {
    return 'A placa deve seguir o formato antigo (AAA0000) ou Mercosul (AAA0A00).';
  }
}

export function IsVehiclePlate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsVehiclePlateConstraint,
    });
  };
}
