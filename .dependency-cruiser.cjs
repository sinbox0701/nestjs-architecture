/**
 * dependency-cruiser — 모듈 경계 fitness function.
 *
 * docs/convention/01-project-structure.md / 02-module-rules.md / 04-layer-responsibility.md
 * 의 경계 규칙을 의존 그래프 수준에서 자동 집행한다. ESLint(문법)가 못 잡는
 * "A 모듈이 B 모듈의 repository를 직접 import" 같은 경계 침식을 CI에서 차단한다.
 *
 * 강제하는 것 (아래 forbidden 규칙이 실제로 막는 것):
 *   1) 역의존 금지: 하위 레이어(common/core/lib)가 modules를 import 못 한다.
 *   2) 모듈 간 내부 침투 금지: 타 도메인의 entity/repository/service 직접 import 금지
 *      (도메인 간 읽기는 그 도메인이 공개한 *-read.service.ts만, 쓰기 연계는 이벤트).
 *   3) common은 순수 유지: core/lib에 대한 런타임 결합 지양 (warn).
 *
 * 주의: 이건 "modules → lib → core → common" 같은 단계 체인을 강제하는 게 아니다.
 *   modules는 common/core/lib를 모두 자유롭게 import한다. 막는 것은 (a) 위로 향하는 의존과
 *   (b) 다른 모듈 내부로의 침투뿐이다. 레이어 간 허용 방향은 "아래로만".
 *   (core → lib 는 허용: AuthGuard가 lib/access-control 사용.)
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
        '쓰기 연계는 이벤트를 사용하라 (04-layer-responsibility.md / 10-query-strategy.md).',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/.+\\.(repository|entity)\\.ts$',
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'no-cross-module-services',
      comment:
        '도메인 간 동기 연결은 Module imports/exports를 통한 "한방향" 직접 호출이 기본이다 ' +
        '(02-module-rules.md#동기-vs-비동기-연결-선택). 순환은 no-circular가 error로 차단한다. ' +
        '이 warn은 차단이 아니라 신호다 — cross-module service import가 늘어나면 경계 침식이 ' +
        '시작됐다는 뜻이니, 읽기만 필요하면 *-read.service.ts, 순환·트랜잭션 분리가 필요하면 ' +
        '이벤트 전환을 검토하라 (MOD-004).',
      severity: 'warn',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        // 타 도메인의 *.service.ts. 같은 모듈 내부와 읽기 전용 *-read.service.ts(공개 읽기 API)는 예외.
        path: '^src/modules/([^/]+)/.+\\.service\\.ts$',
        pathNot: ['^src/modules/$1/', '[-.]read\\.service\\.ts$'],
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
