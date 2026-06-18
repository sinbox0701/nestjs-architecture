import { AuthSubject } from '@/lib/access-control';

/**
 * Express Request 보강.
 * AuthGuard가 검증 후 `request.user`에 AuthSubject를 주입한다.
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthSubject;
    }
  }
}

export {};
