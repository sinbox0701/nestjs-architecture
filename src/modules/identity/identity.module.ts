import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { USER_CREDENTIAL_PORT } from '@/modules/auth/user-credential.port';

import { UserResourcePolicy } from './access/user.resource-policy';
import { RoleController } from './controller/role.controller';
import { TeamController } from './controller/team.controller';
import { UserController } from './controller/user.controller';
import { Role } from './entity/role.entity';
import { Team } from './entity/team.entity';
import { User } from './entity/user.entity';
import { RoleRepository } from './repository/role.repository';
import { TeamRepository } from './repository/team.repository';
import { UserRepository } from './repository/user.repository';
import { RoleService } from './service/role.service';
import { TeamService } from './service/team.service';
import { UserService } from './service/user.service';
import { UserCredentialAdapter } from './service/user-credential.adapter';

/**
 * Identity 모듈 — User / Team / Role (하나의 bounded context).
 *
 * 세 엔티티는 FK로 묶여 있어 한 모듈에 둔다(모듈 경계상 타 모듈 entity 직접 import 금지).
 * auth 모듈의 `USER_CREDENTIAL_PORT`를 구현(UserCredentialAdapter)해 export한다 → AuthModule이 주입.
 *
 * Team/Role의 CRUD 컨트롤러는 Phase C에서 추가한다.
 */
@Module({
  imports: [MikroOrmModule.forFeature([User, Team, Role])],
  controllers: [UserController, RoleController, TeamController],
  providers: [
    UserRepository,
    RoleRepository,
    TeamRepository,
    UserService,
    RoleService,
    TeamService,
    UserResourcePolicy,
    UserCredentialAdapter,
    { provide: USER_CREDENTIAL_PORT, useExisting: UserCredentialAdapter },
  ],
  exports: [USER_CREDENTIAL_PORT],
})
export class IdentityModule {}
