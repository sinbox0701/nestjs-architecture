import { UnderscoreNamingStrategy } from '@mikro-orm/core';

import pluralize from 'pluralize';

export class CustomNamingStrategy extends UnderscoreNamingStrategy {
  private readonly suffixesToRemove = ['Schema', 'Entity', 'Model', 'Orm'];

  classToTableName(entityName: string): string {
    // 접미사 제거
    let cleanName = entityName;
    for (const suffix of this.suffixesToRemove) {
      if (entityName.endsWith(suffix)) {
        cleanName = entityName.slice(0, -suffix.length);
        break;
      }
    }

    const name = super.classToTableName(cleanName);
    return pluralize(name);
  }

  /**
   * FK 조인 컬럼명. 기본 UnderscoreNamingStrategy는 `classToTableName`(복수형)을 써서 `roles_id`처럼
   * 복수형 FK가 생긴다. 테이블은 복수(`roles`)로 두되 FK 컬럼은 관례대로 단수(`role_id`)가 되도록
   * 엔티티명의 단수 underscore를 쓴다.
   */
  override joinKeyColumnName(
    entityName: string,
    referencedColumnName?: string,
    _composite?: boolean,
    tableName?: string,
  ): string {
    // super.classToTableName(부모 구현)은 복수화 없이 단수 underscore를 반환 → role_id/team_id.
    // 부모 시그니처를 그대로 받아 명시적 tableName(있으면)을 위임한다(composite FK/커스텀 조인 대비).
    return super.classToTableName(entityName, tableName) + '_' + (referencedColumnName ?? 'id');
  }
}
