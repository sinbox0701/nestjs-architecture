import { Provider } from '@nestjs/common';

import { ACCESS_POLICY_PROVIDER, StaticAccessPolicyProvider } from '@/lib/access-control';

import { IDENTITY_ROLE_MATRIX, resolveAccessRoles } from './identity-access.matrix';

/**
 * Tier1 capability 매트릭스 구현을 `ACCESS_POLICY_PROVIDER` 토큰에 바인딩한다.
 * 스타터 기본값(DenyAll)을 역할 이름 기반 매트릭스로 교체한다 — 합성 루트(AppModule)에서 사용.
 */
export const identityAccessPolicyProvider: Provider = {
  provide: ACCESS_POLICY_PROVIDER,
  useFactory: () => new StaticAccessPolicyProvider(IDENTITY_ROLE_MATRIX, resolveAccessRoles),
};
