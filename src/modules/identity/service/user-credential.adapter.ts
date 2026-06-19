import { Injectable } from '@nestjs/common';

import { PasswordUtil } from '@/common/utils/password.util';
import { AuthIdentity, UserCredentialPort } from '@/modules/auth/user-credential.port';

import { User } from '../entity/user.entity';
import { UserRepository } from '../repository/user.repository';

/**
 * auth 모듈의 `UserCredentialPort`(DIP)를 User 도메인으로 구현한다.
 * auth는 User 엔티티를 모르고, 이 어댑터가 user→team→role을 조회해 AuthIdentity로 변환한다.
 */
@Injectable()
export class UserCredentialAdapter implements UserCredentialPort {
  constructor(private readonly userRepo: UserRepository) {}

  async validateCredentials(email: string, password: string): Promise<AuthIdentity | null> {
    const user = await this.userRepo.findByEmailForAuth(email);
    if (!user) return null;
    const ok = await PasswordUtil.verify(user.password, password);
    return ok ? this.toIdentity(user) : null;
  }

  async getIdentity(userId: number): Promise<AuthIdentity | null> {
    const user = await this.userRepo.findByIdForAuth(userId);
    return user ? this.toIdentity(user) : null;
  }

  private toIdentity(user: User): AuthIdentity {
    const team = user.team.getEntity(); // populate된 소속팀
    const accessRole = team.role.getEntity(); // populate된 역할
    return {
      id: user.id,
      globalRoles: user.globalRoles,
      role: { id: accessRole.id, name: accessRole.name },
      team: { id: team.id, position: user.position },
    };
  }
}
