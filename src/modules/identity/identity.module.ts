import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';

import { USER_CREDENTIAL_PORT } from '@/modules/auth/user-credential.port';

import { AuthorityTeamController } from './controller/authority-team.controller';
import { TeamController } from './controller/team.controller';
import { UserController } from './controller/user.controller';
import { AuthorityTeam } from './entity/authority-team.entity';
import { Team } from './entity/team.entity';
import { User } from './entity/user.entity';
import { AuthorityTeamRepository } from './repository/authority-team.repository';
import { TeamRepository } from './repository/team.repository';
import { UserRepository } from './repository/user.repository';
import { AuthorityTeamService } from './service/authority-team.service';
import { TeamService } from './service/team.service';
import { UserService } from './service/user.service';
import { UserCredentialAdapter } from './service/user-credential.adapter';

/**
 * Identity 모듈 — User / Team / AuthorityTeam (하나의 bounded context).
 *
 * 세 엔티티는 FK로 묶여 있어 한 모듈에 둔다(모듈 경계상 타 모듈 entity 직접 import 금지).
 * auth 모듈의 `USER_CREDENTIAL_PORT`를 구현(UserCredentialAdapter)해 export한다 → AuthModule이 주입.
 *
 * Team/AuthorityTeam의 CRUD 컨트롤러는 Phase C에서 추가한다.
 */
@Module({
  imports: [MikroOrmModule.forFeature([User, Team, AuthorityTeam])],
  controllers: [UserController, AuthorityTeamController, TeamController],
  providers: [
    UserRepository,
    AuthorityTeamRepository,
    TeamRepository,
    UserService,
    AuthorityTeamService,
    TeamService,
    UserCredentialAdapter,
    { provide: USER_CREDENTIAL_PORT, useExisting: UserCredentialAdapter },
  ],
  exports: [USER_CREDENTIAL_PORT],
})
export class IdentityModule {}
