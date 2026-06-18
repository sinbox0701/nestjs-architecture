/**
 * Time Utility
 *
 * 시간 관련 유틸리티 함수
 */

/**
 * Duration 문자열을 초로 변환
 *
 * @param duration - '3h', '7d', '30m', '60s' 등의 형식
 * @returns 초 단위 시간
 *
 * @example
 * parseDurationToSeconds('7d')  // 604800
 * parseDurationToSeconds('3h')  // 10800
 * parseDurationToSeconds('30m') // 1800
 * parseDurationToSeconds('60s') // 60
 */
/**
 * endAt 날짜를 해당 일자 말(23:59:59.999)로 정규화
 *
 * 날짜만 지정된 endAt(00:00:00)이 마지막 날을 제외하는 문제를 방지한다.
 *
 * @param date - 정규화할 날짜
 * @returns 해당 일자의 23:59:59.999로 설정된 새 Date 객체
 */
export function normalizeEndOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setUTCHours(23, 59, 59, 999);
  return normalized;
}

export function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60; // 기본값: 7일
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 60 * 60;
    case 'd':
      return value * 24 * 60 * 60;
    default:
      return 7 * 24 * 60 * 60;
  }
}
