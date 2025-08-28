# ExamPage 리팩토링 계획

## 현재 구조 (1068줄 단일 파일)
```
ExamPage
├── 라우팅 & 인증 로직
├── 시험 상태 관리 (21개 useState)
├── 7개 useEffect hooks
├── 이벤트 핸들러들 (15개)
├── UI 렌더링 (500줄)
└── 3개 모달 컴포넌트
```

## 제안된 구조 분할

### 1. 컨테이너/프레젠테이션 패턴
```
apps/web/app/student/exam/[examId]/
├── page.tsx (100줄) - 라우팅 & 데이터 페칭만
├── components/
│   ├── ExamContainer.tsx (200줄) - 상태 관리 & 비즈니스 로직
│   ├── ExamStartScreen.tsx (150줄) - 시작 화면
│   ├── ExamInterface.tsx (200줄) - 메인 시험 UI
│   ├── ExamModals.tsx (100줄) - 모든 모달들
│   └── ExamNavigation.tsx (100줄) - 네비게이션 로직
├── hooks/
│   ├── useExamTimer.ts (80줄) - 타이머 로직
│   ├── useExamAnswer.ts (60줄) - 답안 관리
│   ├── useExamExit.ts (50줄) - 종료 로직
│   └── useExamModals.ts (40줄) - 모달 상태
└── types/
    └── exam-page.types.ts (30줄) - 페이지별 타입
```

### 2. 각 파일별 책임

#### page.tsx (100줄)
- 라우팅 파라미터 처리
- 인증 체크
- ExamContainer로 위임

#### ExamContainer.tsx (200줄)
- useExamStore 연결
- 전역 상태 관리
- 자식 컴포넌트들에 props 전달

#### 커스텀 훅들
- useExamTimer: 타이머 관련 모든 로직
- useExamAnswer: 답안 저장/검증
- useExamExit: 종료 확인 플로우
- useExamModals: 모달 상태 관리

### 3. 타입 정의 통합
```typescript
// apps/web/types/exam.types.ts
export interface ExamPageState {
  showStartScreen: boolean
  currentAnswer: string
  isUserSelecting: boolean
  // ... 모든 상태 타입 정의
}

export interface ExamPageProps {
  examId: string
  // ... props 타입
}

export interface ExamHandlers {
  handleStartExam: () => void
  handleAnswerChange: (answer: string) => void
  // ... 핸들러 타입
}
```