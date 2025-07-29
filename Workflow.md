# 개발 & 배포 워크플로우 가이드

## 배포 시스템 개요
- **플랫폼**: Vercel (자동 배포)
- **트리거**: Git push 시 자동 배포
- **구조**: pnpm 모노레포

## 배포 트리거
- **main 브랜치 push** → 프로덕션 배포
- **PR 생성/업데이트** → 미리보기 배포
- **수동 배포** → Vercel 대시보드/CLI

## 권장 개발 워크플로우

### 1. 로컬에서 먼저 확인
```bash
pnpm dev          # 로컬 개발 서버 실행 (포트 3000)
pnpm type-check   # TypeScript 타입 체크
pnpm lint         # ESLint 검사
pnpm build        # 프로덕션 빌드 테스트
```

### 2. 안전한 배포 과정 (권장)
```bash
# 새 브랜치 생성
git checkout -b feature/새기능이름

# 코드 수정 후 로컬 테스트
pnpm dev
pnpm type-check
pnpm build

# 커밋 & 푸시
git add .
git commit -m "새 기능 추가"
git push origin feature/새기능이름

# GitHub에서 PR 생성
# → Vercel이 자동으로 미리보기 배포 생성
# → 미리보기 URL에서 확인
# → 문제없으면 main에 merge
```

### 3. 위험한 방법 (비추천)
```bash
# main 브랜치에 바로 push
git push origin main  # ⚠️ 바로 프로덕션 배포됨!
```

## 오류 발생시 대처법

### 빌드 실패시
- Vercel이 배포 중단 (이전 버전 유지)
- Vercel 대시보드에서 에러 로그 확인
- 로컬에서 `pnpm build` 실행해서 오류 재현

### 런타임 오류시
- 이전 배포 버전으로 롤백 가능 (Vercel 대시보드)
- 핫픽스 브랜치 생성해서 긴급 수정

## 유용한 명령어

### 루트 레벨 (모노레포 전체)
```bash
pnpm build        # 모든 패키지 빌드
pnpm dev          # 모든 개발 서버 실행
pnpm lint         # 전체 린팅
pnpm type-check   # 전체 타입 체크
pnpm test         # 전체 테스트 실행
pnpm format       # 코드 포맷팅
```

### 웹앱 레벨 (apps/web/)
```bash
cd apps/web
pnpm dev          # 웹앱만 개발 서버
pnpm build        # 웹앱만 빌드
pnpm lint         # 웹앱만 린팅
pnpm type-check   # 웹앱만 타입 체크
```

## Vercel 배포 설정
- **빌드 명령어**: `pnpm --filter @satbank/web build`
- **설치 명령어**: `pnpm install`
- **출력 디렉토리**: `apps/web/.next`

### 배포 과정 세부사항
1. **트리거**: Git push 또는 PR 생성
2. **의존성 설치**: `pnpm install` (모노레포 전체 의존성)
3. **빌드 과정**: `pnpm --filter @satbank/web build`
   - Next.js 빌드 실행 (웹앱 전용)
   - TypeScript 트랜스파일
   - 앱 최적화 및 번들링
   - 정적 자산 생성
4. **배포**: `apps/web/.next` 디렉토리 내용 배포
5. **환경변수**: Supabase 설정 (`apps/web/.env.local`)

## 환경 변수
- **로컬**: `apps/web/.env.local`
- **배포**: Vercel 대시보드에서 설정
- **Supabase 연동**: URL, API Key 등

## 체크리스트

### 코드 수정 전
- [ ] 새 브랜치 생성
- [ ] 로컬 개발 서버 실행 확인

### 코드 수정 후
- [ ] `pnpm dev`로 로컬 테스트
- [ ] `pnpm type-check`로 타입 에러 체크
- [ ] `pnpm lint`로 코드 스타일 체크
- [ ] `pnpm build`로 빌드 성공 확인

### 배포 전
- [ ] PR 생성
- [ ] 미리보기 배포 확인
- [ ] 코드 리뷰 (필요시)
- [ ] main 브랜치에 merge

### 배포 후
- [ ] 프로덕션 사이트 동작 확인
- [ ] 오류 모니터링 (Vercel 대시보드)

## 긴급상황 대응
- **사이트 다운**: Vercel 대시보드에서 이전 배포로 롤백
- **데이터베이스 문제**: Supabase 대시보드 확인
- **빌드 실패**: 로컬에서 `pnpm build` 실행해서 오류 확인