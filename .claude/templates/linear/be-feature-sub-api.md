## 📌 작업 범위

<이 이슈에서 노출할 엔드포인트>

## 🏗️ 구현 항목

### Endpoint

[] `METHOD /path` —

- 인증 필요: Yes / No

- 권한: @Roles(RoleCode.X) 또는 @Public()

### Request DTO

[] `XxxRequestDto`

- ## 검증 규칙:

### Response DTO

[] `XxxResponseDto`

### Controller

[] `XxxController.methodName()`

- 적용할 Guard:

- 적용할 Interceptor:

### 예외 → HTTP 매핑

도메인 예외 | HTTP 상태 | 에러 코드
XxxNotFoundException | 404 | XXX_NOT_FOUND

### Swagger 문서화

[] `jsDoc` 작성

### ✅ 완료 조건

[] Controller/DTO 구현 완료

[] 모든 검증 규칙 작동

[] Guard/인가 적용

[] Swagger 문서 정상 생성

[] e2e 테스트 작성 및 통과

[] 타입체크/린트 통과

## 🧪 테스트

### e2e 테스트 (supertest)

[] 200/201 정상 응답

[] 400 검증 실패 케이스

[] 401/403 인증·인가 실패

[] 도메인 예외별 응답 코드 확인

## ⚠️ 사람이 반드시 검증할 부분

[] 인가 로직 누락 없는가 (가장 흔한 실수)

[] 민감 정보가 응답에 노출되지 않는가

[] Rate limiting 필요 여부

[] CORS, CSRF 영향
