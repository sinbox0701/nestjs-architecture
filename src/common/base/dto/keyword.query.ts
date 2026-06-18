import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 검색어 쿼리 베이스. 페이지네이션 쿼리와 `IntersectionType`으로 조합한다.
 *
 * 실제 검색 컬럼/매칭 방식(LIKE, full-text 등)은 repository에서 정의한다.
 * 여기서는 입력 계약(`q`)만 표준화한다.
 */
export class KeywordQuery {
  /** 검색어 */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
