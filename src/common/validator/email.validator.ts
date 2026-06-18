import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const EMAIL_LOCAL_PART_MAX = 64;
const EMAIL_DOMAIN_MAX = 255;

@ValidatorConstraint({ async: false })
export class IsEmailPartsConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const atIndex = value.lastIndexOf('@');
    if (atIndex < 0) return false;
    const localPart = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1);
    return localPart.length <= EMAIL_LOCAL_PART_MAX && domain.length <= EMAIL_DOMAIN_MAX;
  }

  defaultMessage(): string {
    return `이메일 로컬파트는 ${EMAIL_LOCAL_PART_MAX}자, 도메인은 ${EMAIL_DOMAIN_MAX}자 이하여야 합니다.`;
  }
}

/** 이메일 로컬파트(64자)·도메인(255자) 개별 길이 검증. `{ each: true }` 지원. */
export function IsEmailParts(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsEmailPartsConstraint,
    });
  };
}
