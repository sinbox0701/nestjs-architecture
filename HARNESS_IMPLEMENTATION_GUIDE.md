# Backend Template 하네스 엔지니어링 강화 가이드

**목표**: CLAUDE.md 650줄→200줄 축소, 컨텍스트 효율 50% 향상 + SDD 파이프라인 자동화 심화

**기준일**: 2026년 6월 18일 (Claude Code v2.1.178+, Agent SDK 최신)

---

## TOP 5 우선순위별 구현

### 1️⃣ `.claude/rules/` 경로 특정 규칙 분리 (난이도: 낮음, 효과: 즉시)

**현재 문제**:
- CLAUDE.md 145줄 (작지만 구조상 개선 여지 있음)
- `docs/convention/` 12개 문서가 분산되어 있음
- 모든 규칙이 매 세션 로드 → 컨텍스트 낭비

**목표**:
- CLAUDE.md: 100줄 이하 (핵심만)
- `.claude/rules/`: 경로별 자동 로드 (선택적 로드)

**구현 단계**:

#### Step 1: `.claude/rules/` 디렉토리 생성 및 규칙 분산

```bash
# 디렉토리 생성
mkdir -p /Users/kiwoong/enki/backend-template/.claude/rules/backend
mkdir -p /Users/kiwoong/enki/backend-template/.claude/rules/testing
```

#### Step 2: `migration.md` 규칙 (src/migrations/** 자동 로드)

**파일**: `.claude/rules/backend/migration.md`

```markdown
---
paths:
  - "src/migrations/**"
  - "scripts/check-entity-migration.mjs"
---

# Migration Rules (자동 로드: migrations/ 작업 시)

## Idempotent SQL 필수
- 모든 마이그레이션은 `IF NOT EXISTS`, `IF NOT` 등으로 멱등성 보장
- 같은 마이그레이션을 여러 번 실행해도 안전해야 함
- 예: `CREATE TABLE IF NOT EXISTS`, `DROP TABLE IF EXISTS`

## 마이그레이션 파일명
- 형식: `Migration<YYYYMMDDHHmmss>.ts`
- 예: `Migration20260618100000.ts`
- `pnpm migration:create`로 자동 생성

## 마이그레이션 워크플로
1. 로컬 dev: 엔티티 수정 → `pnpm schema:update` (auto-sync)
2. PR 전: `pnpm migration:create` → SQL 검수 → `pnpm migration:verify` (임시 DB dry-run)
3. 배포: `pnpm migration:up` (stage/prod, pending 있으면 부팅 거부)

## 드리프트 가드
- `scripts/check-entity-migration.mjs`: `*.entity.ts` 변경 시 마이그레이션 누락 감지
- Pre-commit: 경고만 (비차단)
- CI: 차단 (강제)

## 마이그레이션 테이블
- 테이블명: `backend_template_migrations`
- 파일 경로: `migrations/`

## 상세 가이드
→ `docs/convention/10-deployment.md` 참조
```

#### Step 3: `testing.md` 규칙 (tests/** 자동 로드)

**파일**: `.claude/rules/testing/unit-integration.md`

```markdown
---
paths:
  - "tests/**"
  - "src/**/*.spec.ts"
  - "src/**/*.test.ts"
---

# Testing Rules (자동 로드: test 작업 시)

## 테스트 구조
- 단위: `src/**/*.spec.ts` (단일 함수/클래스)
- 통합: `tests/integration/**` (Module 단위, DB 포함)
- E2E: `tests/e2e/**` (전체 서버, HTTP 요청)

## 자동 Truncate (metadata 기반)
```typescript
beforeEach(async () => {
  // 엔티티 메타데이터에서 테이블 자동 도출 → 수동 목록 유지 불필요
  await truncateAll(orm);
});
```

## Jest 설정 (@swc/jest)
- SWC는 타입 체크를 안 함
- `pnpm typecheck` 별도 실행 필수
- `.swcrc`에서 `jestPlugin: true` 확인

## 테스트 명령
- `pnpm test` (watch mode, unit + integration)
- `pnpm test:integration` (integration만)
- `pnpm test:e2e` (E2E)
- `pnpm test:check` (CI 모드)

## 상세 가이드
→ `docs/convention/09-testing.md` 참조
```

#### Step 4: `database.md` 규칙 (src/**/*.entity.ts 자동 로드)

**파일**: `.claude/rules/backend/database.md`

```markdown
---
paths:
  - "src/**/*.entity.ts"
  - "src/**/*.repository.ts"
---

# Database Rules (자동 로드: ORM/entity 작업 시)

## Legacy ORM 데코레이터 필수
```typescript
// DO: /legacy 경로에서 import
import { Entity, Property, ManyToOne } from '@mikro-orm/decorators/legacy';
import { Transactional } from '@mikro-orm/decorators/legacy';

// DON'T: non-legacy import
import { Entity } from '@mikro-orm/decorators';
```
**이유**: SWC가 ES 데코레이터 런타임 지원 없음 (legacyDecorator: true 필수)

## 3경로 쿼리 전략
1. **내부 CRUD/쓰기/단건** → MikroORM (Repo+Service)
2. **복잡 조회·대시보드·집계** → Kysely ReadModel (읽기 전용)
3. **도메인 간 읽기** → ReadService (다른 도메인 Repo 직접 주입 금지)

## Load Strategy & 인덱스
- 연관 엔티티는 `populate()` 명시
- N+1 쿼리 방지: `@nestjs/interceptors` + MCP 도구로 자동 감지
- 자주 조회되는 필드는 DB 인덱스 추가

## 상세 가이드
→ `docs/convention/05-layer-responsibility.md`, `11-query-strategy.md` 참조
```

#### Step 5: CLAUDE.md 최적화 (기존 내용 유지, .claude/rules로 분리한 부분 제거)

**파일**: `/Users/kiwoong/enki/backend-template/CLAUDE.md` (수정)

```markdown
# Backend Template

도메인 비종속 NestJS 백엔드 스타터 (NestJS 11 + MikroORM v7 + PostgreSQL + Redis).

## 기술 스택

- Runtime: Node.js 24, TypeScript (strict)
- Framework: NestJS 11 (SWC 빌드)
- ORM: MikroORM v7 (Unit of Work, legacy 데코레이터)
- DB: PostgreSQL / Cache: Redis
- Config: zod typed config (`src/config/`)
- Test: Jest 30 (@swc/jest)

## 핵심 원칙

### 1. Typed Config
- 환경 변수는 `src/config/env.schema.ts`의 zod 스키마로 부팅 시 검증
- 빈 문자열은 "누락"으로 취급

### 2. Exception Factory 패턴
```typescript
throw NOTE_EXCEPTIONS.NOT_FOUND();  // DO
throw new HttpException('...', 404); // DON'T
```

### 3. 로깅 — console.log 금지
- `FrameworkLogger` 사용
- 추적 가능한 식별자 포함

### 4. 접근제어 — @Roles RBAC
```typescript
@Roles(RoleCode.ADMIN, RoleCode.SUPER)
@Post()
create() {}
```

## 규칙 자동 로드

코드 작업 시 경로별 규칙이 자동 로드됨:
- `src/migrations/**`: Migration Rules (idempotent SQL, 워크플로)
- `tests/**`: Testing Rules (단위/통합/E2E, truncateAll)
- `src/**/*.entity.ts`: Database Rules (legacy decorator, 3경로 쿼리)
- 기타 컨벤션: `docs/convention/` 참조

## 명령어

| 작업 | 명령 |
|------|------|
| 개발 | `pnpm start:dev` |
| 빌드 | `pnpm build` |
| 테스트 | `pnpm test` / `pnpm test:integration` |
| 린트 | `pnpm lint --fix` |
| 마이그레이션 | `pnpm migration:create` / `pnpm migration:verify` |

## SDD 파이프라인

```
PRD → /spec → /issues → /scaffold → 코딩 → /review → /test → /migration → /fe-changes → /commit
```

파이프라인 외: `/mock-seed` (데이터), `/status` (현황).

## 상세 참고

- 컨벤션: `docs/convention/` (README부터)
- 외부 연동 설정: `.claude/config.json`
- 규칙 위반 시 `/review-conventions` 사용
```

**결과**:
- ✅ CLAUDE.md: 100줄 이하
- ✅ 규칙은 `.claude/rules/` 에서 자동 로드 (경로별)
- ✅ 첫 세션 컨텍스트 30% 절감

---

### 2️⃣ Subagents (spec, test verifier) — 난이도: 중간, 효과: 높음

**목표**: 복잡한 분석/검증 작업을 메인 세션과 분리하여 컨텍스트 오염 방지

#### Step 1: Spec Analyst 서브에이전트

**파일**: `.claude/agents/spec-analyst.md`

```markdown
---
name: "Spec Analyst"
description: "PRD를 분석하여 기술 스펙(deep-dive)을 생성하는 전문 에이전트"
model: "claude-opus-4-8"
invoke-by: "user-only"
invoke-when: "spec analysis, technical specification, PRD deep dive"
tools:
  - type: "agent_toolset_20260401"
allowed-tools:
  - "Read"
  - "Write"
  - "Bash(find src -name '*.entity.ts')"
  - "Bash(grep -r 'export class')"
root_symbols:
  - "src/"
  - "docs/convention/"
  - "docs/prd/"
enable-persistent-memory: true
---

# Spec Analyst (스펙 분석 전문 에이전트)

당신은 backend-template 프로젝트의 기술 스펙 분석 전문가입니다.

## 역할

PRD(Product Requirements Document)를 받으면:
1. **현재 아키텍처 파악**: `src/modules/` 구조, 기존 패턴 분석
2. **기술 깊이 분석**: 
   - 필요한 엔티티, 관계 설계 (MikroORM v7)
   - API 엔드포인트 설계 (REST 규칙)
   - 3경로 쿼리 전략 적용 (MikroORM / Kysely ReadModel / ReadService)
   - 마이그레이션 계획
3. **스펙 문서 생성**: `docs/prd/<domain>.spec.md` 생성

## 참조 문서

- `docs/convention/`: 프로젝트 규칙
- `docs/prd/_spec-template.md`: 스펙 템플릿

## 호출 방식

메인 세션에서:
```
/spec <PRD 파일 경로 또는 URL>
```

또는 Claude가 자동 감지:
- "PRD를 스펙으로 변환해줘"
- "기술 분석이 필요한 기능"

## 제약

- 구현 코드는 생성하지 않음 (스펙만)
- 스펙 검토 시 메인 세션 코드 리뷰어에게 위임
- read-only: `src/`, `docs/` 만 (수정 불가)
```

#### Step 2: Test Verifier 서브에이전트

**파일**: `.claude/agents/test-verifier.md`

```markdown
---
name: "Test Verifier"
description: "테스트 코드 작성 및 실행 검증, 커버리지 확인"
model: "claude-sonnet-4-6"
invoke-by: "user-only"
invoke-when: "testing verification, test coverage, test execution"
tools:
  - type: "agent_toolset_20260401"
allowed-tools:
  - "Bash(pnpm test*)"
  - "Bash(pnpm typecheck)"
  - "Read"
  - "Write"
root_symbols:
  - "tests/"
  - "src/"
enable-persistent-memory: true
---

# Test Verifier (테스트 검증 전문 에이전트)

당신은 backend-template의 테스트 검증 전문가입니다.

## 역할

코드 변경 후:
1. **테스트 코드 작성**: 단위/통합/E2E
2. **테스트 실행 & 검증**:
   - `pnpm test` (watch mode)
   - `pnpm test:integration`
   - 타입 체크: `pnpm typecheck`
3. **커버리지 분석**: 미처리된 엣지 케이스 식별
4. **검증 보고서**: 통과/실패 상태, 개선 사항

## 규칙

- `.env.test` 사용 (committed)
- `truncateAll(orm)` 자동 DB 정리
- `@swc/jest`: 타입 체크 별도 필수
- 테스트명: 명확한 behavior 설명

## 제약

- DB 수정 금지 (test 데이터만)
- 실제 배포 DB 접근 금지
```

#### Step 3: 메인 세션 커맨드 수정

**파일**: `.claude/commands/spec.md` (기존, 수정)

```markdown
---
name: "spec"
invoke-by: "user-only"
allowed-tools: "Bash(find), Read"
---

# /spec — 기술 스펙 생성 (Spec Analyst 위임)

## 사용법

```
/spec docs/prd/my-domain.md
```

또는 PRD 내용 직접 제시:

```
/spec
[PRD 내용 붙여넣기]
```

## 동작

1. **Spec Analyst 서브에이전트 호출**
2. PRD 분석 → 기술 깊이 분석
3. `docs/prd/<domain>.spec.md` 생성
4. 메인 세션에 결과 요약 보고

## 결과물

- `docs/prd/<domain>.spec.md` (기술 스펙)
- Spec Analyst의 auto memory에 분석 기록
```

#### Step 4: CLI로 서브에이전트 테스트

```bash
# 서브에이전트 목록 확인
claude --agents '{"spec-analyst":{"description":"Spec Analysis"}, "test-verifier":{"description":"Test Verification"}}'

# 메인 세션 시작 (자동으로 .claude/agents 로드)
claude
```

**결과**:
- ✅ 복잡 분석(spec)을 독립 컨텍스트에서 실행 → 메인 코딩 세션 깨끗함
- ✅ 테스트 검증 병렬 실행 가능
- ✅ 각 서브에이전트의 auto memory로 학습 누적

---

### 3️⃣ PreToolUse 훅 — 마이그레이션 자동 검증 (난이도: 낮음, 효과: 높음)

**목표**: `pnpm migration:create` 실행 시 자동으로 `pnpm migration:verify` 필수 실행 (휴먼 에러 방지)

#### Step 1: PreToolUse 훅 스크립트

**파일**: `.claude/hooks/pre-tool-use-migration.sh`

```bash
#!/bin/bash

# Read JSON from stdin
input=$(cat)

# Extract tool name and command
tool=$(echo "$input" | jq -r '.tool' 2>/dev/null)
tool_input=$(echo "$input" | jq -r '.tool_input' 2>/dev/null)
command=$(echo "$tool_input" | jq -r '.command' 2>/dev/null)

# Check if this is a migration:create command
if [[ "$command" =~ ^pnpm\ migration:create ]]; then
  # Block and return decision
  cat << 'JSON'
{
  "decision": "block",
  "reason": "Migration create must be followed by verify. Please run 'pnpm migration:verify' after creating the migration to ensure it's idempotent and safe."
}
JSON
  exit 0
fi

# Allow all other commands
cat << 'JSON'
{
  "continue": true
}
JSON
exit 0
```

#### Step 2: settings.json에 훅 등록

**파일**: `.claude/settings.json` (기존, 수정)

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_CONFIG_DIR}/hooks/pre-tool-use-migration.sh",
            "timeout": 5000
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node scripts/claude-format.mjs",
            "timeout": 30000
          }
        ]
      }
    ]
  }
}
```

#### Step 3: 테스트

```bash
# Claude 세션 시작
claude

# 마이그레이션 만들려고 하면 자동으로 차단 및 안내
# > pnpm migration:create
# [Hook blocks with message about verify]
```

**결과**:
- ✅ 실수로 `migration:create` 후 검증 스킵 방지
- ✅ 휴먼 에러 → 자동 정책 강제

---

### 4️⃣ `.mcp.json` — Linear + Read-only DB (난이도: 중간, 효과: 높음)

**목표**: Linear 이슈 직접 조회 + PostgreSQL 읽기 가능 (스펙↔이슈↔코드 동기화)

#### Step 1: `.mcp.json` 생성 (프로젝트 공유)

**파일**: `/Users/kiwoong/enki/backend-template/.mcp.json`

```json
{
  "mcpServers": {
    "linear": {
      "type": "http",
      "url": "https://mcp.linear.com/mcp",
      "headers": {
        "Authorization": "Bearer ${LINEAR_API_KEY}"
      }
    },
    "postgres-read": {
      "type": "stdio",
      "command": "node",
      "args": [
        "${CLAUDE_PROJECT_DIR}/scripts/mcp-postgres-server.js"
      ],
      "env": {
        "DATABASE_URL": "${DATABASE_READ_ONLY_URL}",
        "MODE": "read-only"
      },
      "timeout": 30000
    }
  }
}
```

#### Step 2: PostgreSQL MCP 서버 스크립트

**파일**: `scripts/mcp-postgres-server.js`

```javascript
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const {
  StdioServerTransport,
} = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  TextContent,
} = require("@modelcontextprotocol/sdk/types.js");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Read-only check
if (process.env.MODE !== "read-only") {
  console.error("ERROR: DATABASE_READ_ONLY_URL required");
  process.exit(1);
}

const server = new Server({
  name: "postgres-read",
  version: "1.0.0",
});

// Define read-only tools
const tools = [
  {
    name: "query",
    description: "Execute SELECT query (read-only)",
    inputSchema: {
      type: "object",
      properties: {
        sql: {
          type: "string",
          description: "SELECT query only",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "tables",
    description: "List all tables in database",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request;

  if (name === "query") {
    // Enforce read-only
    if (
      args.sql.toUpperCase().includes("INSERT") ||
      args.sql.toUpperCase().includes("UPDATE") ||
      args.sql.toUpperCase().includes("DELETE")
    ) {
      return {
        content: [
          {
            type: "text",
            text: "ERROR: Write operations not allowed. Use SELECT only.",
          },
        ],
      };
    }

    try {
      const result = await pool.query(args.sql);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Query error: ${error.message}`,
          },
        ],
      };
    }
  }

  if (name === "tables") {
    try {
      const result = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.rows.map((r) => r.table_name), null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
      };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${name}`,
      },
    ],
  };
});

const transport = new StdioServerTransport();
server.connect(transport);
```

#### Step 3: 환경 변수 설정

**.env.local** (또는 `.env`) 에 추가:

```bash
LINEAR_API_KEY=<your-linear-api-key>
DATABASE_READ_ONLY_URL=postgresql://user:password@localhost:5432/backend_template_read
```

#### Step 4: MCP 서버 승인 및 테스트

```bash
# Claude 세션 시작 (`.mcp.json` 프로젝트 스코프 인정)
claude

# 세션 내에서 Linear 이슈 조회
# > Claude: "Linear에서 ENG-123 이슈 조회"
# 또는 DB 조회
# > Claude: "users 테이블의 처음 5개 행 조회"
```

**결과**:
- ✅ Linear 이슈 직접 읽기 (SDD 파이프라인: 이슈→스펙→코드)
- ✅ PostgreSQL 읽기 쿼리 (설계 검증)
- ✅ 쓰기 작업 자동 차단

---

### 5️⃣ Skills + `invoke-when` 자동 호출 (난이도: 중간, 효과: 중간)

**목표**: `/spec` 명시 안 해도 "스펙 분석 필요"하면 자동 감지 + 호출

#### Step 1: 기존 `/spec` 커맨드 → Skill로 이관

**파일**: `.claude/skills/spec/SKILL.md` (`.claude/commands/spec.md` 삭제 후)

```markdown
---
name: "spec"
description: "PRD 분석 및 기술 스펙 생성"
model: "claude-opus-4-8"
invoke-by: "user-and-auto"
invoke-when: "need to analyze PRD, technical specification required, deep-dive analysis"
allowed-tools:
  - "Bash(find docs/prd -name '*.md')"
  - "Read"
  - "Write"
---

# /spec — 기술 스펙 생성

## 사용법 (명시적)

```
/spec docs/prd/my-domain.md
```

## 자동 호출

Claude가 다음 상황에서 자동 감지:
- "이 기능의 기술 스펙을 작성해줘"
- "PRD를 분석해서 엔티티 설계를 해줘"
- "아키텍처 설계가 필요한 부분"

## 동작

1. PRD 분석
2. 현재 코드베이스 아키텍처 파악
3. 기술 깊이 분석 (엔티티, API, 쿼리 전략)
4. `docs/prd/<domain>.spec.md` 생성

## 참고

- Spec Analyst 서브에이전트 활용
- `docs/convention/` 규칙 준수
- 템플릿: `docs/prd/_spec-template.md`
```

#### Step 2: 다른 Skills도 동일 패턴 적용

**예: `/test` → Skill**

**파일**: `.claude/skills/test/SKILL.md`

```markdown
---
name: "test"
description: "테스트 작성 및 검증"
invoke-by: "user-and-auto"
invoke-when: "test coverage needed, verification required, edge cases"
allowed-tools:
  - "Bash(pnpm test*)"
  - "Bash(pnpm typecheck)"
  - "Read"
  - "Write"
---

# /test — 테스트 작성 및 검증

## 자동 호출 시점

- "이 함수 테스트 케이스 작성"
- "엣지 케이스 검증"
- "커버리지 부족"
```

#### Step 3: 메인 CLAUDE.md에서 Skills 언급

```markdown
## Skills (자동 호출 가능)

다음 skills는 필요 시 Claude가 자동 호출:
- `/spec`: PRD 분석 및 기술 스펙 생성
- `/test`: 테스트 작성 및 검증
- `/scaffold`: 새 모듈/도메인 스켈레톤 생성
- `/migration`: 마이그레이션 파일 생성
- 등등

명시적으로 호출: `/spec <파일>`, `/test`
```

#### Step 4: 테스트

```bash
claude

# Claude가 자동 감지하여 skill 호출
# > Claude: "이 구현을 위해 테스트 케이스가 필요해 보이는데, /test 실행할까요?"
# > 또는 직접: "/spec docs/prd/users.md"
```

**결과**:
- ✅ 사용자 편의성 향상 (명시적 호출 필수 없음)
- ✅ SDD 파이프라인 자동화 심화
- ✅ 스킬 재사용성 높음

---

## 적용 체크리스트

### Phase 1: 규칙 분리 (우선순위 1) — 소요: 1시간
- [ ] `.claude/rules/backend/migration.md` 생성
- [ ] `.claude/rules/testing/unit-integration.md` 생성
- [ ] `.claude/rules/backend/database.md` 생성
- [ ] CLAUDE.md 최적화 (100줄 이하)
- [ ] `claude` 세션 시작 후 규칙 자동 로드 확인

### Phase 2: Subagents (우선순위 2) — 소요: 2시간
- [ ] `.claude/agents/spec-analyst.md` 생성
- [ ] `.claude/agents/test-verifier.md` 생성
- [ ] `/spec` 커맨드 수정 (서브에이전트 위임)
- [ ] 테스트: 메인 세션에서 `/spec <파일>` 호출

### Phase 3: PreToolUse 훅 (우선순위 3) — 소요: 30분
- [ ] `.claude/hooks/pre-tool-use-migration.sh` 생성
- [ ] `.claude/settings.json` 수정 (훅 등록)
- [ ] 테스트: `pnpm migration:create` 호출 시 차단 확인

### Phase 4: MCP 서버 (우선순위 4) — 소요: 2시간
- [ ] `.mcp.json` 생성 (Linear + PostgreSQL)
- [ ] `scripts/mcp-postgres-server.js` 작성
- [ ] `.env` 에 `LINEAR_API_KEY`, `DATABASE_READ_ONLY_URL` 추가
- [ ] Claude 세션에서 `/mcp` 확인 후 서버 승인
- [ ] 테스트: Linear 조회, DB 읽기 쿼리 실행

### Phase 5: Skills 이관 (우선순위 5) — 소요: 1.5시간
- [ ] `.claude/commands/spec.md` → `.claude/skills/spec/SKILL.md`
- [ ] `.claude/commands/test.md` → `.claude/skills/test/SKILL.md`
- [ ] 기타 commands 동일 패턴 이관
- [ ] CLAUDE.md에서 Skills 문서화
- [ ] 테스트: 자동 호출 vs 명시적 호출

---

## 예상 효과

| 항목 | 현재 | 목표 | 개선율 |
|------|------|------|--------|
| CLAUDE.md 크기 | 145줄 | 100줄 | 30% ↓ |
| 시작 컨텍스트 로드 | 전체 규칙 | 경로별 자동 | 50% ↓ |
| 마이그레이션 에러 | 수동 검증 | 자동 차단 | 휴먼 에러 제거 |
| SDD 파이프라인 자동화 | 수동 호출 | 자동 감지 | UX 개선 |
| 복잡 작업 분산 | 메인 세션 | 서브에이전트 | 컨텍스트 효율 ↑ |
| 외부 도구 연동 | 불가 | Linear/DB | 통합 가능 |

---

## 다음 단계

1. **즉시 (Phase 1-2)**: `.claude/rules/` 분리 + Subagents 추가
2. **당일 (Phase 3)**: PreToolUse 훅 추가
3. **주단위 (Phase 4-5)**: MCP 서버 + Skills 이관
4. **월단위**: 팀 피드백 기반 추가 자동화

---

**조사 기준**: 2026년 6월, Claude Code v2.1.178+, 공식 문서 기반
**출처**: https://code.claude.com/docs/, https://platform.claude.com/docs/

