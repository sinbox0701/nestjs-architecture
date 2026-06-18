/**
 * 리소스에 수행하는 액션. CRUD를 기본으로 하고, `MANAGE`는 와일드카드(모든 액션 허용)다.
 * 도메인 특화 액션은 문자열로 확장한다(예: `'order:cancel'`). 그래서 매트릭스/데코레이터는
 * `Action` 대신 `ActionLike`를 받는다.
 */
export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage', // 와일드카드: 모든 액션
}

export type ActionLike = Action | string;
