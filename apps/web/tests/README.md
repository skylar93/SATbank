# 테스트 가이드

이 문서는 SAT Mock Exam 플랫폼의 테스트 설정과 실행 방법을 설명합니다.

## 테스트 구조

프로젝트는 세 가지 레벨의 테스트를 포함하고 있습니다:

```
tests/
├── unit/                    # 단위 테스트 (기존)
│   ├── answer-checker.test.ts
│   ├── answer-validation.test.ts
│   └── utils.test.ts
├── integration/             # 통합 테스트 (새로 추가)
│   ├── exam-submission.test.ts
│   └── test-utils.ts
└── e2e/                     # E2E 테스트 (새로 추가)
    ├── student-exam-flow.spec.ts
    └── test-data-setup.ts
```

## 테스트 유형별 설명

### 1. 단위 테스트 (Unit Tests)

- **목적**: 개별 함수와 유틸리티의 정확성 검증
- **도구**: Vitest + Testing Library
- **범위**: 순수 함수, 유틸리티, 컴포넌트 로직

### 2. 통합 테스트 (Integration Tests)

- **목적**: 여러 시스템 컴포넌트가 함께 작동하는지 검증
- **도구**: Vitest + Supabase
- **범위**: Store + API + Database 연동 테스트
- **특징**: 실제 데이터베이스와 상호작용

### 3. E2E 테스트 (End-to-End Tests)

- **목적**: 실제 사용자 시나리오의 전체 워크플로우 검증
- **도구**: Playwright
- **범위**: 브라우저를 통한 완전한 사용자 여정 테스트

## 테스트 실행 방법

### 전체 테스트 실행

```bash
# 모든 테스트 실행 (단위 + 통합 + E2E)
pnpm test:all
```

### 개별 테스트 유형 실행

```bash
# 단위 테스트만 실행
pnpm test

# 통합 테스트만 실행
pnpm test:integration

# E2E 테스트만 실행
pnpm test:e2e

# E2E 테스트 (브라우저 화면 보기)
pnpm test:e2e:headed

# E2E 테스트 (UI 모드)
pnpm test:e2e:ui
```

### 개발 중 테스트 (Watch 모드)

```bash
# 단위/통합 테스트를 watch 모드로 실행
pnpm test --watch

# 단위 테스트 UI로 실행
pnpm test:ui
```

## 테스트 설정

### 통합 테스트 설정

통합 테스트는 로컬 Supabase 인스턴스와 연결하여 실제 데이터베이스 작업을 수행합니다:

1. **자동 테스트 데이터 생성**: 각 테스트 실행 시 임시 사용자, 시험, 문제가 생성됩니다
2. **자동 정리**: 테스트 완료 후 생성된 테스트 데이터가 자동으로 삭제됩니다
3. **격리**: 각 테스트는 독립적인 데이터 세트를 사용합니다

### E2E 테스트 설정

E2E 테스트 실행 전에 테스트 데이터가 필요합니다:

```typescript
// E2E 테스트용 시드 데이터 생성
import { setupE2ETestData } from './tests/e2e/test-data-setup'

// 테스트 실행 전에 한 번 실행
await setupE2ETestData()
```

**테스트 계정 정보:**

- 이메일: `student@test.com`
- 비밀번호: `password123`

## 테스트 작성 가이드

### 통합 테스트 작성

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { useExamStore } from '@/store/exam-store'
import { setupTestData, cleanupTestData } from './test-utils'

describe('새로운 기능 통합 테스트', () => {
  let testData

  beforeAll(async () => {
    testData = await setupTestData()
  })

  afterAll(async () => {
    await cleanupTestData(testData)
  })

  it('should test the integrated functionality', async () => {
    // 테스트 로직 작성
  })
})
```

### E2E 테스트 작성

```typescript
import { test, expect } from '@playwright/test'

test('새로운 사용자 시나리오', async ({ page }) => {
  await page.goto('/login')

  // 사용자 액션 시뮬레이션
  await page.getByLabel(/email/i).fill('student@test.com')
  await page.getByLabel(/password/i).fill('password123')
  await page.getByRole('button', { name: /log in/i }).click()

  // 결과 검증
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible()
})
```

## 테스트 데이터 관리

### 통합 테스트

- **자동 관리**: `setupTestData()`와 `cleanupTestData()` 함수가 테스트 데이터를 자동으로 생성/삭제합니다
- **격리**: 각 테스트는 고유한 사용자 ID와 시험 ID를 사용합니다

### E2E 테스트

- **시드 데이터**: `setupE2ETestData()` 함수로 고정된 테스트 데이터를 생성합니다
- **재사용**: 여러 E2E 테스트에서 동일한 테스트 계정을 공유합니다

## 성능 고려사항

### 통합 테스트

- 실제 데이터베이스 연결로 인해 단위 테스트보다 느립니다
- 각 테스트는 약 5-10초 소요됩니다
- 병렬 실행 시 데이터베이스 연결 수 제한을 고려해야 합니다

### E2E 테스트

- 브라우저 시작과 페이지 렌더링으로 인해 가장 느립니다
- 전체 시험 시나리오는 약 2-3분 소요됩니다
- CI/CD 환경에서는 헤드리스 모드로 실행됩니다

## 트러블슈팅

### 통합 테스트 이슈

```bash
# Supabase 연결 오류
Error: Failed to create test user: Invalid JWT

# 해결: 로컬 Supabase가 실행 중인지 확인
supabase status
```

### E2E 테스트 이슈

```bash
# 브라우저 설치 오류
Error: Executable doesn't exist at /path/to/browser

# 해결: 브라우저 재설치
pnpm dlx playwright install --with-deps
```

### 일반적인 테스트 이슈

```bash
# 포트 충돌
Error: Port 3000 is already in use

# 해결: 개발 서버가 실행 중인 경우 종료 후 테스트 실행
```

## CI/CD 통합

테스트는 다음 순서로 실행되는 것을 권장합니다:

1. **단위 테스트** (빠름, 항상 실행)
2. **타입 체크 및 린팅** (빠름, 항상 실행)
3. **통합 테스트** (보통, PR 시 실행)
4. **빌드 검증** (보통, 항상 실행)
5. **E2E 테스트** (느림, 메인 브랜치 병합 시 실행)

```yaml
# GitHub Actions 예시
- name: Run all tests
  run: |
    pnpm test
    pnpm type-check
    pnpm lint
    pnpm test:integration
    pnpm build
    pnpm test:e2e
```

## 테스트 커버리지

현재 테스트 커버리지:

- **단위 테스트**: 핵심 유틸리티 함수들
- **통합 테스트**: 시험 제출 워크플로우
- **E2E 테스트**: 전체 학생 시험 응시 플로우

### 향후 확장 계획

- 관리자 기능 E2E 테스트
- 오답노트 기능 통합 테스트
- 성능 테스트
- 접근성 테스트
