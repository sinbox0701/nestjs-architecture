import { SetMetadata } from '@nestjs/common';

import { RoleCode } from './role-code.enum';

export const ROLES_KEY = 'roles';

/**
 * 핸들러/컨트롤러에 허용 역할을 지정한다.
 *
 * @example
 *   @Roles(RoleCode.ADMIN)
 *   @Get('admin-only')
 *   adminOnly() {}
 */
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
