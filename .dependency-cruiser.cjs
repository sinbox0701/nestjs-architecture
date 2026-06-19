/**
 * dependency-cruiser — 모듈 경계 fitness function.
 *
 * docs/convention/01-project-structure.md / 03-module-rules.md / 05-layer-responsibility.md
 * 의 경계 규칙을 의존 그래프 수준에서 자동 집행한다. ESLint(문법)가 못 잡는
 * "A 모듈이 B 모듈의 repository를 직접 import" 같은 경계 침식을 CI에서 차단한다.
 *
 * 레이어 의존 방향 (위 → 아래만 허용):
 *   modules → lib → core → common
 *   (core → lib 는 현행 허용: AuthGuard가 lib/access-control 사용)
 *
 * 실행: pnpm dep:check
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: '순환 의존은 모듈 경계 붕괴의 신호다. 공통 부분을 아래 레이어로 내리거나 이벤트로 분리하라.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-common-to-modules',
      comment: 'common(순수 유틸)은 도메인(modules)을 알면 안 된다.',
      severity: 'error',
      from: { path: '^src/common/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-core-to-modules',
      comment: 'core(앱 전역 인프라)는 특정 도메인(modules)에 의존하면 안 된다.',
      severity: 'error',
      from: { path: '^src/core/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-lib-to-modules',
      comment: 'lib(외부 인프라)은 도메인(modules)에 의존하면 안 된다.',
      severity: 'error',
      from: { path: '^src/lib/' },
      to: { path: '^src/modules/' },
    },
    {
      name: 'no-cross-module-internals',
      comment:
        '다른 도메인의 repository/entity를 직접 import 금지. 도메인 간 읽기는 해당 도메인의 ReadService, ' +
        '쓰기 연계는 이벤트를 사용하라 (05-layer-responsibility.md / 11-query-strategy.md).',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/.+\\.(repository|entity)\\.ts$',
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'no-common-to-app-layers',
      comment:
        'common은 core/lib에 의존하지 않는 순수 레이어가 이상적이다. 런타임 결합만 거버넌스하며, ' +
        '앰비언트 타입 증강(*.d.ts: 예) express Request.user에 AuthSubject 주입)은 런타임 결합이 ' +
        '아니므로 제외한다. 새 코드에서 런타임 결합을 늘리지 말 것.',
      severity: 'warn',
      from: { path: '^src/common/', pathNot: '\\.d\\.ts$' },
      to: { path: '^src/(core|lib)/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.js', '.json'],
    },
    includeOnly: '^src/',
  },
};
