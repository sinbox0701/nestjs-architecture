## 📌 작업 범위

<이 이슈에서 무엇을 할지 한두 문장>

## 🏗️ 구현 항목

### Entity

[] `XxxEntity` 정의 또는 수정

- 필드:

- 인덱스:

- 관계 (Relations):

### Repository

[] 기본 Repository 사용

[] 커스텀 Repository 필요

- 커스텀 메서드:
  - findAll()

  - findById()

  - getById()

### Migration

[] Migration 파일 생성

[] 롤백 검증

[] 기존 데이터 마이그레이션 스크립트 (필요 시)

## ✅ 완료 조건

[] Entity 정의 완료

[] Migration 정상 적용 및 롤백 가능

[] Repository 단위/통합 테스트 작성 및 통과

[] 타입체크/린트 통과

## 🧪 테스트

[] Repository 통합 테스트 (Testcontainers 또는 테스트 DB)

- 커버 시나리오:
  - 정상 케이스

  - 빈 결과 케이스

  - 제약 조건 위반 (unique, not null 등)

### ⚠️ 주의사항
