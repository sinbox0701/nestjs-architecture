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
}
