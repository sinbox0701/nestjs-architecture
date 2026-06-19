import { CanActivate, ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { Request } from 'express';
import request from 'supertest';

import { UnauthorizedException } from '@/common/exceptions';
import { AuthSubject, GlobalRole, PolicyGuard } from '@/lib/access-control';
import { identityAccessPolicyProvider } from '@/modules/identity/access/identity-access.provider';
import { UserController } from '@/modules/identity/controller/user.controller';
import { TeamPosition } from '@/modules/identity/enum/team-position.enum';
import { UserService } from '@/modules/identity/service/user.service';

/**
 * 사용자 API E2E (경량 패턴) — HTTP 파이프라인만 검증한다:
 *  - Tier0 인증(401), Tier1 capability(@Requires + 실제 PolicyGuard + 실제 매트릭스: Red=관리/Blue=읽기),
 *    ValidationPipe(400), 응답 포맷.
 * Tier2 소유권(IDOR)·DB 쿼리는 integration에서 검증하므로 여기선 UserService를 mock한다.
 */

/** x-test-role 헤더로 주체를 시뮬레이션하는 Tier0 가드. 헤더 없으면 401. */
class HeaderAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthSubject }>();
    const role = req.headers['x-test-role'] as string | undefined;
    if (!role) throw new UnauthorizedException('인증이 필요합니다.');
    if (role === 'SUPER') {
      req.user = { id: 1, jti: 't', globalRoles: [GlobalRole.SUPER], teams: [] };
      return true;
    }
    // Red/Blue 등 역할 이름을 그대로 capability 키로 싣는다(JWT의 role 클레임 시뮬레이션).
    req.user = {
      id: 1,
      jti: 't',
      globalRoles: [],
      role: { id: 1, name: role },
      teams: [{ teamId: 7, role: TeamPosition.LEADER }],
    } as AuthSubject;
    return true;
  }
}

const mockUserService = {
  createUser: jest
    .fn()
    .mockResolvedValue({ id: 1, email: 'a@x.com', name: '에이', teamId: 7, position: TeamPosition.MEMBER }),
  getUserList: jest.fn().mockResolvedValue({ list: [], count: 0 }),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn().mockResolvedValue(undefined),
};

describe('Users API (E2E, 경량)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        identityAccessPolicyProvider, // 실제 Tier1 매트릭스
        { provide: APP_GUARD, useClass: HeaderAuthGuard }, // Tier0
        { provide: APP_GUARD, useClass: PolicyGuard }, // Tier1
        Reflector,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: true } }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const body = { email: 'a@x.com', password: 'password123', name: '에이', teamId: 7, position: TeamPosition.MEMBER };

  it('인증 없이 접근하면 401', async () => {
    await request(server()).get('/api/users').expect(401);
  });

  it('Blue(읽기 전용)는 사용자 목록 조회 가능(200)', async () => {
    await request(server()).get('/api/users').set('x-test-role', 'Blue').expect(200);
  });

  it('Blue(읽기 전용)는 사용자 생성 거부(403, Tier1)', async () => {
    await request(server()).post('/api/users').set('x-test-role', 'Blue').send(body).expect(403);
    expect(mockUserService.createUser).not.toHaveBeenCalled();
  });

  it('Red(관리)는 사용자 생성 가능(201) + 응답 포맷(data 래핑)', async () => {
    const res = await request(server()).post('/api/users').set('x-test-role', 'Red').send(body).expect(201);
    expect(res.body).toMatchObject({ data: { email: 'a@x.com', teamId: 7 } });
    expect(mockUserService.createUser).toHaveBeenCalled();
  });

  it('매트릭스에 없는 역할(Green)은 거부(403, default-deny)', async () => {
    await request(server()).get('/api/users').set('x-test-role', 'Green').expect(403);
  });

  it('SUPER는 전부 통과(생성 201)', async () => {
    await request(server()).post('/api/users').set('x-test-role', 'SUPER').send(body).expect(201);
  });

  it('잘못된 입력(이메일 형식/짧은 비번)은 400(ValidationPipe)', async () => {
    await request(server())
      .post('/api/users')
      .set('x-test-role', 'Red')
      .send({ ...body, email: 'not-email', password: '123' })
      .expect(400);
  });
});
