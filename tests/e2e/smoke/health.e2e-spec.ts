import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { TestAuthGuard } from '@test-utils/testing-modules/test-auth.guard';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { AuthGuard } from '@/core/auth/auth.guard';

describe('e2e smoke (health)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(AuthGuard)
      .useClass(TestAuthGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health-check -> 200 with APP_NAME', async () => {
    const appName = process.env.APP_NAME ?? 'backend-template';

    const res = await request(app.getHttpServer()).get('/api/health-check');

    expect(res.status).toBe(200);
    expect(res.text).toBe(appName);
  });
});
