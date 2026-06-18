import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * 커서 페이지네이션 쿼리 베이스 (`R.cursorPage`/`findPageByCursor`와 짝).
 *
 * 무한 스크롤·대용량 목록에 쓴다. deep page 성능 저하가 없는 대신 임의 페이지 점프는 불가.
 *
 * ```typescript
 * export class GetFeedListRequest extends IntersectionType(CursorPageQuery, KeywordQuery) {}
 * // repo
 * const { list, nextPageCursor } = await this.repo.findPageByCursor({
 *   first: query.pageSize,
 *   after: query.cursor,
 *   orderBy: { createdAt: 'desc', id: 'desc' }, // 안정 정렬(고유 키 포함)
 * });
 * ```
 */
export class CursorPageQuery {
  /** 이전 응답의 `nextPageCursor`. 첫 페이지는 생략. */
  @IsOptional()
  @IsString()
  cursor?: string;

  /** 페이지당 항목 수 (1~100) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
