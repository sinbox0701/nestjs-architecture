import { applyDecorators } from '@nestjs/common';

import { Transform } from 'class-transformer';
import { IsBoolean as OriginalIsBoolean } from 'class-validator';

export function IsBool() {
  return applyDecorators(
    Transform(({ obj, key }) => valueToBoolean(obj[key]), { toClassOnly: true }),
    OriginalIsBoolean(),
  );
}

function valueToBoolean(value: any) {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (['true', 'on', 'yes', '1'].includes(lower)) return true;
    if (['false', 'off', 'no', '0'].includes(lower)) return false;
  }
  return value;
}
