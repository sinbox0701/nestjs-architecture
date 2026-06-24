import { Injectable } from '@nestjs/common';

import { PasswordUtil } from '@/common/utils/password.util';
import { AuthIdentity, UserCredentialPort } from '@/modules/auth/user-credential.port';

import { User } from '../entity/user.entity';
import { UserRepository } from '../repository/user.repository';

/**
 * 사용자 부재 시에도 argon2 검증을 수행하기 위한 더미 해시(최초 1회 계산 후 메모이즈).
 * 미존재 이메일이면 검증을 건너뛰던 기존 동작은 응답 시간 차이로 이메일 존재 여부를 노출한다
 * (user enumeration 타이밍 사이드채널). 항상 해시를 검증해 타이밍을 평탄화한다.
 */
let dummyHashPromise: Promise<string> | undefined;
function dummyHash(): Promise<string> {
  if (!dummyHashPromise) dummyHashPromise = PasswordUtil.hash('timing-attack-dummy-password');
  return dummyHashPromise;
}

/**
 * auth 모듈의 `UserCredentialPort`(DIP)를 User 도메인으로 구현한다.
 * auth는 User 엔티티를 모르고, 이 어댑터가 user→team→role을 조회해 AuthIdentity로 변환한다.
 */
@Injectable()
export class UserCredentialAdapter implements UserCredentialPort {
  constructor(private readonly userRepo: UserRepository) {}

  async validateCredentials(email: string, password: string): Promise<AuthIdentity | null> {
    const user = await this.userRepo.findByEmailForAuth(email);
    // 사용자가 없어도 더미 해시로 검증을 수행한다(타이밍 평탄화). 성공/실패 메시지는 호출측에서 동일하게 처리.
    const hash = user?.password ?? (await dummyHash());
    const ok = await PasswordUtil.verify(hash, password);
    return user && ok ? this.toIdentity(user) : null;
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
