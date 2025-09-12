-- 간단한 SQL 버전 (기본적인 마크다운만 처리)
-- 복잡한 변환은 JavaScript 버전 권장

-- 백업 먼저!
-- pg_dump your_db > backup.sql

BEGIN;

-- 간단한 패턴들만 처리
UPDATE questions SET 
  question_text = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(question_text, '**', '<strong>'), 
        '**', '</strong>'
      ),
      '*', '<em>'
    ),
    '*', '</em>'
  )
WHERE question_text ~ '\*+';

-- 더 복잡한 변환은 JavaScript 스크립트 사용 권장
ROLLBACK; -- 실제 실행시에는 COMMIT;으로 변경