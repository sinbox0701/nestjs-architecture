import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * 한글(완성형+자음/모음) + ASCII 인쇄 가능 문자(0x20-0x7E) + 탭 + 줄바꿈
 * → 제목, 비JSON 본문에 사용 (이모지·확장유니코드 불허)
 */
export const KOREAN_ASCII_TEXT_PATTERN = /^[가-힣ㄱ-ㅎㅏ-ㅣ\x20-\x7E\t\r\n]*$/;

/**
 * 한글(완성형+자음/모음) + ASCII 인쇄 가능 문자(0x20-0x7E) + 탭 (줄바꿈 불허)
 * → 검색 키워드에 사용
 */
export const KOREAN_ASCII_NO_NEWLINE_PATTERN = /^[가-힣ㄱ-ㅎㅏ-ㅣ\x20-\x7E\t]*$/;

/**
 * 이모지 감지 패턴
 * - Extended_Pictographic: 일반 이모지 (😀, 🎉, ❤️ 등)
 * - Regional_Indicator:    국기 이모지 (🇰🇷, 🇺🇸 등)
 * - Keycap sequence:       키캡 이모지 (1️⃣, #️⃣ 등) — 숫자/#/* + VS16? + ⃣
 */
export const EMOJI_PATTERN = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[\d#*]\uFE0F?\u20E3/u;

/** 줄바꿈 감지 패턴 */
export const NEWLINE_PATTERN = /[\r\n]/;

// ── 제목/비JSON 본문용: 한글 + ASCII만 허용 ──

@ValidatorConstraint({ async: false })
export class IsKoreanAsciiTextConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return KOREAN_ASCII_TEXT_PATTERN.test(value);
  }

  defaultMessage(): string {
    return '한글, ASCII 범위 문자만 사용할 수 있습니다.';
  }
}

/**
 * 한글 + ASCII 인쇄 문자만 허용 (이모지·확장유니코드 불허).
 * 제목, 비JSON 본문, 퀴즈/설문 텍스트에 사용.
 * `{ each: true }` 지원.
 */
export function IsKoreanAsciiText(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsKoreanAsciiTextConstraint,
    });
  };
}

// ── 제목/옵션용: 한글 + ASCII, 줄바꿈 불허 ──

@ValidatorConstraint({ async: false })
export class IsKoreanAsciiNoNewlineConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return KOREAN_ASCII_NO_NEWLINE_PATTERN.test(value);
  }

  defaultMessage(): string {
    return '한글, ASCII 범위 문자만 사용할 수 있으며, 줄바꿈은 불가합니다.';
  }
}

/**
 * 한글 + ASCII 인쇄 문자만 허용, 줄바꿈 불허.
 * 제목, 객관식 옵션 등 한 줄 텍스트에 사용.
 * `{ each: true }` 지원.
 */
export function IsKoreanAsciiNoNewline(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsKoreanAsciiNoNewlineConstraint,
    });
  };
}

// ── 검색 키워드용: 한글 + ASCII, 줄바꿈 불허 ──

@ValidatorConstraint({ async: false })
export class IsSearchKeywordConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    return KOREAN_ASCII_NO_NEWLINE_PATTERN.test(value);
  }

  defaultMessage(): string {
    return '검색어에는 한글, ASCII 범위 문자만 사용 가능합니다.';
  }
}

/** 검색 키워드 문자 검증: 한글 + ASCII, 줄바꿈·이모지 불허 */
export function IsSearchKeyword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSearchKeywordConstraint,
    });
  };
}

// ── 플래그용: 줄바꿈·이모지 불허, 그 외 허용 ──

@ValidatorConstraint({ async: false })
export class IsNoEmojiNoNewlineConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (NEWLINE_PATTERN.test(value)) return false;
    if (EMOJI_PATTERN.test(value)) return false;
    return true;
  }

  defaultMessage(): string {
    return '줄바꿈 문자와 이모지는 사용할 수 없습니다.';
  }
}

/** 플래그 문자 검증: 줄바꿈·이모지 불허, 그 외 허용. `{ each: true }` 지원. */
export function IsNoEmojiNoNewline(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsNoEmojiNoNewlineConstraint,
    });
  };
}
