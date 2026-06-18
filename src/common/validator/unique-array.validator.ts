import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class UniqueArrayConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value)) return true; // 배열이 아니면 다른 validator에서 처리
    return new Set(value).size === value.length;
  }

  defaultMessage(): string {
    return '배열에 중복된 값이 포함되어 있습니다.';
  }
}

/** 배열 내 중복 값 불허 데코레이터 */
export function UniqueArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: UniqueArrayConstraint,
    });
  };
}
