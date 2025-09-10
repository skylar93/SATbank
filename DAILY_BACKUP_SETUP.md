# 📅 Daily Backup 설정 가이드

매일 자동으로 전체 데이터를 백업하는 시스템입니다.

## 🔧 설정 방법

### 1. GitHub Secrets 설정

GitHub 레포지토리에서:
1. `Settings` → `Secrets and variables` → `Actions` 이동
2. `New repository secret` 클릭하고 다음 두 개 추가:

```
이름: NEXT_PUBLIC_SUPABASE_URL
값: https://eoyzqdsxlweygsukjnef.supabase.co

이름: SUPABASE_SERVICE_ROLE_KEY  
값: [Supabase Dashboard → Settings → API → service_role key]
```

### 2. 즉시 테스트

GitHub에서 `Actions` 탭 → `Daily Data Backup` → `Run workflow` 클릭

### 3. 백업 확인

성공하면 `scripts/backups/YYYY-MM-DD/` 폴더에 파일들이 생깁니다:
- `questions.json` - 모든 문제 데이터
- `exams.json` - 시험 정보
- `test_attempts.json` - 시험 응시 기록
- `user_answers.json` - 답안 기록
- `user_profiles.json` - 사용자 프로필
- `_backup_summary.json` - 백업 요약

## 🕐 스케줄

- **매일 한국시간 오전 2시** 자동 실행
- **30일간** 백업 파일 보관 (그 이후 자동 삭제)
- **수동 실행**도 언제든지 가능

## 📊 백업 파일 구조

```json
{
  "table": "questions",
  "backup_date": "2024-09-10T17:00:00.000Z",
  "total_records": 1887,
  "records": [
    {
      "id": "...",
      "exam_id": "...",
      "question_text": "...",
      // ... 전체 데이터
    }
  ]
}
```

## 🚨 복구 방법

만약 데이터 손실이 발생하면:

1. **GitHub에서 백업 파일 다운로드**
   ```
   scripts/backups/YYYY-MM-DD/questions.json
   ```

2. **Supabase Dashboard에서 복구**
   - 백업 파일을 열어서 `records` 배열 복사
   - INSERT 쿼리로 데이터 복원

## ⚠️ 주의사항

- GitHub 레포가 private인지 확인 (백업 데이터 보안)
- Service Role Key는 절대 코드에 하드코딩하지 마세요
- 백업 파일이 너무 커지면 Git LFS 고려

## 🔍 백업 상태 확인

GitHub Actions 페이지에서 매일 백업 성공/실패 확인 가능:
- ✅ 녹색: 백업 성공
- ❌ 빨간색: 백업 실패 (이메일 알림 옴)

---

**💡 이제 매일 자동으로 전체 데이터가 백업됩니다!** 더 이상 데이터 손실 걱정 없어요 😊