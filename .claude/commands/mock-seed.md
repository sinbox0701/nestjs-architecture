---
name: mock-seed
description: 데브서버용 mock 데이터 시더를 생성한다. `.data.ts`(원하는 데이터 선언) + `.seed.ts`(삽입 로직)로 분리하며, anchor 데이터는 손으로 선언하고 filler만 faker로 채운다.
argument-hint: "<domain> [fillerCount] [--fresh] — 예: /mock-seed user 50"
---

데브 서버를 채우기 위한 mock 시더를 생성한다.
**핵심 원칙: 데이터는 선언, faker는 채움.** 네가 로그인하고 클릭해볼 데이터는 손으로 선언하고, 단순 볼륨만 faker로 만든다.

## 인자 해석

$ARGUMENTS 를 아래 규칙으로 해석한다.

- 첫 번째 인자: 도메인/엔티티 이름 (예: `user`, `order`)
- 두 번째 인자(선택): filler 개수 (생략 시 0 = anchor만)
- `--fresh`: 시드 전에 해당 테이블을 truncate (dev 전용)

예시: `/mock-seed user 50`, `/mock-seed order --fresh`

## 사전 준비

1. 대상 엔티티를 읽는다: `src/**/entity/*.entity.ts`. 필드, 타입, **nullable/unique/enum 제약**, **관계(@ManyToOne 등)와 방향**을 파악한다. 엔티티가 없으면 먼저 `/scaffold`로 모듈을 만들라고 안내하고 중단한다.
2. `src/lib/database/setup-mock.ts`, `src/lib/database/seed/seed.util.ts`(`withOrm`), `docs/convention/09-testing.md`, `docs/convention/11-query-strategy.md` 를 읽는다.
3. 비밀번호/해시 필드가 있으면 `argon2`로 해싱한다(평문 저장 금지).

## 데이터 의도 확인 (가장 중요)

코드를 짜기 전에, **사용자가 원하는 데이터**를 명확히 한다. 아래를 질문하거나 인자/대화에서 추론한다. 추론이 불확실하면 반드시 되묻는다.

- **anchor 레코드**: 결정적으로 항상 존재해야 하는 레코드. (예: 로그인용 admin 계정 `admin@backend-template.dev`, 데모 시나리오용 특정 주문) — **정확한 값**을 받는다.
- **filler 개수**: 볼륨 테스트용으로 faker가 채울 추가 레코드 수.
- **관계**: 어떤 부모에 매달리는지, 부모당 자식 몇 개인지.
- **required 필드 중 사용자가 값을 안 준 것**: 합리적 기본/ faker로 채우되, 의미 있는 필드(상태/타입/권한 등)는 되묻는다.

## 생성물

도메인당 두 파일을 만든다(camp `.data.ts`/`.seed.ts` 컨벤션).

### 1. `src/lib/database/seed/mock/<domain>.data.ts` — 데이터 선언(사용자 통제 surface)
- 타입 인터페이스 + **ANCHOR 배열**: 사용자가 준 정확한 값을 그대로 박는다. **여기엔 faker를 절대 쓰지 않는다.**
- filler 설정(개수 등)을 상수로 노출해 사용자가 쉽게 조정하게 한다.
- 파일 상단 주석: "이 파일을 편집해 원하는 데이터를 바꾸세요. anchor는 결정적, filler는 faker."

### 2. `src/lib/database/seed/mock/<domain>.seed.ts` — 삽입 로직
- MikroORM `Seeder` 또는 `withOrm` 콜백으로 구현. EntityManager는 `@mikro-orm/postgresql`에서 import.
- 순서: **anchor 먼저 → filler(faker) 다음**.
- **관계는 부모 시더 먼저** 실행되도록 등록 순서를 잡는다. 부모는 ref로 연결.
- **멱등성**: unique 키(이메일 등) 기준 존재하면 skip. `--fresh`면 `@test-utils` 또는 `truncateAll` 패턴으로 해당 테이블만 비우고 재생성(dev 전용).
- 비밀번호 등 민감 필드는 argon2 해싱. 공유 비밀번호 상수는 파일 상단에.
- enum/nullable/unique 제약을 준수한다.

### 3. `setup-mock.ts`에 등록
- 새 시더를 호출 순서(부모→자식)에 맞게 wiring 한다. prod 가드는 이미 있으므로 유지한다.

## 규칙

- **anchor ≠ faker.** 로그인/시나리오 데이터는 사용자 선언값 그대로. faker는 filler 전용.
- prod 실행 금지(`setup-mock.ts`의 `isProdAppEnv` 가드 유지).
- 멱등 재실행 안전(중복 생성 금지).
- 생성 후 타입/제약이 맞는지 `pnpm typecheck`로 확인.

## 실행 & 검증

1. `pnpm mock:seed` 로 실행.
2. 한 번 더 실행해 **멱등성**(중복 없음)을 확인.
3. anchor 계정으로 로그인/조회가 되는지 확인.

## 출력 보고

- 생성/수정한 파일 경로.
- anchor 레코드 목록(로그인 계정 등 — 사용자가 바로 쓸 수 있게).
- filler 개수.
- 사용자가 `<domain>.data.ts`에서 직접 바꿀 수 있는 지점.
