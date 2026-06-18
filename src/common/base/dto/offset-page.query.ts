import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * 오프셋 페이지네이션 쿼리 베이스 (`R.page`/`findPage`와 짝).
 *
 * 도메인 list 요청 DTO에서 `IntersectionType`으로 조합한다. (sortBy는 도메인 enum이라 베이스에 두지 않는다.)
 *
 * ```typescript
 * import { IntersectionType } from '@nestjs/swagger';
 * export class GetOrderListRequest extends IntersectionType(OffsetPageQuery, KeywordQuery) {
 *   sortBy?: OrderSortBy;
 *   sortOrder: SortOrder = SortOrder.DESC;
 * }
 * // service/repo
 * const { list, count } = await this.repo.findPage(where, { offset: query.offset, limit: query.limit });
 * ```
 *
 * 쿼리스트링→숫자 변환은 전역 ValidationPipe(`enableImplicitConversion`)가 처리한다.
 */
export class OffsetPageQuery {
  /** 1-based 페이지 번호 */
  @IsOptional()
  @IsInt()
  @Min(1)
  pageNum: number = 1;

  /** 페이지당 항목 수 (1~100) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  get offset(): number {
    return (this.pageNum - 1) * this.pageSize;
  }

  get limit(): number {
    return this.pageSize;
  }
}
