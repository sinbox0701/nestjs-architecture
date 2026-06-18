import { Transform } from 'class-transformer';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * @description DTO에서 Date 객체 또는 Date 객체로 변환 가능한 문자열인지 확인하는 데코레이터
 */
export const IsDateOrDateString = (validationOptions?: ValidationOptions) => {
  return (target: object, propertyName: string) => {
    registerDecorator({
      name: 'isDateOrDateString',
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          // Date 객체 또는 Date 객체로 변환 가능한 문자열인지 확인
          if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) return true;
          else return false;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Date object or string`;
        },
      },
    });

    // Transform 데코레이터 추가 (문자열 -> Date 변환)
    Transform(({ value }) => {
      // Date 객체로 변환이 가능할 경우 Date 객체로 변환
      if (typeof value === 'string' && !isNaN(Date.parse(value))) return new Date(value);
      else return value;
    })(target, propertyName);
  };
};
