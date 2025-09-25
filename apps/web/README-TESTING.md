# 🎯 SAT Bank Automated Testing System

이제 **완전 자동화된 채점 시스템 검증**이 가능합니다!

## 🚀 Quick Start

```bash
# 모든 exam 검증 (한 번에!)
pnpm validate:scoring

# 조용한 모드 (CI/CD용)
pnpm validate:scoring:quiet

# JSON만 출력 (프로그래밍 용도)
pnpm validate:scoring:json

# 특정 테스트만 실행
pnpm test:scoring
```

## 🎪 What Does It Test?

### ✅ **전체 Exam Flow 검증**

- 모든 exam의 구조와 설정 검증
- Questions과 answers 형식 검증
- Scoring curves 적용 검증
- 실제 exam 시뮬레이션 및 채점

### ✅ **Multiple Answers 완벽 지원**

- `["192", "192.0", "192.00"]` 같은 다중 정답
- 대소문자 무관 처리
- 공백 처리
- JSON 파싱 오류 방지

### ✅ **Scoring System 검증**

- Raw score → Scaled score 변환
- Scoring curves 데이터 무결성
- 모듈별 점수 계산
- 전체 점수 합산

### ✅ **Edge Cases & Error Handling**

- 잘못된 데이터 형식 처리
- 빈 답변, null 값 처리
- 범위 밖 점수 처리
- 데이터베이스 오류 복구

## 📊 Test Results

실행하면 다음과 같은 정보를 얻습니다:

```
🎯 VALIDATION COMPLETE
===============================================
📊 Success Rate: 98.5%
📝 Exams Tested: 12
📋 Total Questions: 1,247
🔢 Multiple Answer Questions: 89
❌ Total Issues: 3
⏱️  Average Processing Time: 245ms
```

## 📄 Detailed Reports

### HTML Report (시각적)

- 모든 exam 결과 상세보기
- 문제별 이슈 리스트
- 추천사항 및 해결방법
- 저장 위치: `validation-reports/exam-validation-[timestamp].html`

### JSON Report (프로그래밍 용도)

- 모든 테스트 결과 구조화된 데이터
- CI/CD 파이프라인 연동 가능
- 저장 위치: `validation-reports/exam-validation-[timestamp].json`

## 🔧 Integration with Development

### Pre-Deploy Hook

```bash
# 배포 전 자동 검증
pnpm validate:scoring || (echo "❌ Scoring validation failed!" && exit 1)
```

### CI/CD Pipeline

```yaml
- name: Validate Exam Scoring
  run: pnpm validate:scoring:json

- name: Check for Critical Issues
  run: |
    if [ $? -ne 0 ]; then
      echo "Critical scoring issues detected!"
      exit 1
    fi
```

## 🎨 Customization

### Adding New Test Cases

```typescript
// tests/integration/exam-scoring-validation.test.ts
it('should handle your specific case', async () => {
  const result = await testCustomScenario()
  expect(result).toBe(expected)
})
```

### Custom Validation Rules

```typescript
// tests/utils/exam-test-runner.ts
async function validateCustomRule(question: any, result: ExamTestResult) {
  // Your custom validation logic
}
```

## 🔍 Troubleshooting

### Common Issues:

**환경 변수 없음:**

```
❌ Missing required environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
```

→ `.env.local` 파일 확인

**권한 오류:**

```
❌ Failed to fetch questions: permission denied
```

→ Service role key 확인

**테스트 실패:**

```
❌ Question abc123: No valid correct answers
```

→ 해당 문제의 correct_answer 필드 점검

## 🚀 Advanced Features

### 1. **Regression Testing**

새로운 채점 로직 변경 시 기존 결과와 비교:

```typescript
const oldScores = await getHistoricalScores()
const newScores = await calculateWithNewLogic()
expect(scoreDifference).toBeLessThan(acceptableThreshold)
```

### 2. **Performance Monitoring**

채점 속도 추적 및 최적화:

```typescript
const performanceMetrics = await measureScoringPerformance()
expect(performanceMetrics.averageTime).toBeLessThan(500) // ms
```

### 3. **Batch Processing**

대량 데이터 테스트:

```bash
# 1000개 랜덤 답변으로 부하 테스트
pnpm validate:scoring --stress-test --count=1000
```

## 💡 Benefits

- **⏱️ 시간 단축**: 수동 테스팅 99% 감소
- **🎯 정확도 향상**: 놓치기 쉬운 edge case 자동 발견
- **🔒 안정성 보장**: 배포 전 자동 검증
- **📈 품질 향상**: 지속적인 회귀 테스트
- **🧠 스트레스 해소**: 더 이상 수동으로 테스팅하지 마세요!

---

## 🎉 Now You're Free!

이제 **한 번의 명령어**로 모든 채점 시스템을 검증할 수 있습니다.
새로운 문제 추가하거나 채점 로직 변경할 때마다 자동으로 확인하세요!

```bash
pnpm validate:scoring
# ☕ 커피 한 잔 마시는 동안 모든 검증 완료!
```
