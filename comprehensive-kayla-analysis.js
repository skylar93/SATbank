const fs = require('fs');

// Read the backup data
const backupData = fs.readFileSync('/Users/skylar/Desktop/SATbank/remote_data_backup.sql', 'utf8');

console.log('=== KAYLA의 모든 ATTEMPTS 종합 분석 ===\n');

const kaylaUserId = 'c97a96e0-0bc7-413f-a265-77fa11b79792';

// 1. Find all kayla's attempts from backup
console.log('🔍 백업에서 kayla의 모든 attempts 찾기:');
const testAttemptMatches = backupData.match(/INSERT INTO "public"\."test_attempts"[^;]+;/g);
let kaylaAttempts = [];

if (testAttemptMatches) {
    testAttemptMatches.forEach(insert => {
        if (insert.includes(kaylaUserId)) {
            // Extract attempt info
            const match = insert.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/);
            if (match) {
                const [, attempt_id, user_id, exam_id] = match;

                // Extract final_scores
                const scoresMatch = insert.match(/"final_scores"[^,]*,\s*'([^']*)',/);
                const finalScores = scoresMatch ? scoresMatch[1] : 'NULL';

                kaylaAttempts.push({
                    attempt_id,
                    user_id,
                    exam_id,
                    final_scores: finalScores,
                    full_insert: insert
                });
            }
        }
    });
}

console.log(`📊 총 ${kaylaAttempts.length}개의 kayla attempts 발견\n`);

// 2. For each attempt, check if answers exist
console.log('🔍 각 attempt의 답변 존재 여부 확인:');
const userAnswerMatches = backupData.match(/INSERT INTO "public"\."user_answers"[^;]+;/g);

kaylaAttempts.forEach((attempt, index) => {
    console.log(`\n${index + 1}. Attempt: ${attempt.attempt_id}`);
    console.log(`   Exam: ${attempt.exam_id}`);
    console.log(`   Scores: ${attempt.final_scores}`);

    // Check for user_answers
    let answerCount = 0;
    if (userAnswerMatches) {
        userAnswerMatches.forEach(insert => {
            if (insert.includes(attempt.attempt_id)) {
                answerCount++;
            }
        });
    }

    console.log(`   📝 답변 개수: ${answerCount}개`);

    // Check for exam_questions mapping
    const examQuestionMatches = backupData.match(/INSERT INTO "public"\."exam_questions"[^;]+;/g);
    let examQuestionCount = 0;
    if (examQuestionMatches) {
        examQuestionMatches.forEach(insert => {
            if (insert.includes(attempt.exam_id)) {
                examQuestionCount++;
            }
        });
    }

    console.log(`   🔗 Exam Questions: ${examQuestionCount}개`);

    if (answerCount > 0) {
        console.log('   ✅ 복구 가능!');
    } else if (attempt.final_scores !== 'NULL' && attempt.final_scores !== '') {
        console.log('   ⚠️  점수는 있지만 답변 없음 - 의심스러움');
    } else {
        console.log('   ❌ 답변 없음');
    }
});

// 3. Summary of findings
console.log('\n=== 종합 분석 결과 ===');
const attemptsWithAnswers = kaylaAttempts.filter(attempt => {
    let hasAnswers = false;
    if (userAnswerMatches) {
        userAnswerMatches.forEach(insert => {
            if (insert.includes(attempt.attempt_id)) {
                hasAnswers = true;
            }
        });
    }
    return hasAnswers;
});

const attemptsWithScores = kaylaAttempts.filter(attempt =>
    attempt.final_scores !== 'NULL' && attempt.final_scores !== ''
);

console.log(`📊 총 attempts: ${kaylaAttempts.length}개`);
console.log(`✅ 답변이 있는 attempts: ${attemptsWithAnswers.length}개`);
console.log(`📈 점수가 있는 attempts: ${attemptsWithScores.length}개`);
console.log(`⚠️  점수는 있지만 답변 없는 attempts: ${attemptsWithScores.length - attemptsWithAnswers.length}개`);

if (attemptsWithAnswers.length > 0) {
    console.log('\n✅ 복구 가능한 attempts:');
    attemptsWithAnswers.forEach(attempt => {
        console.log(`   - ${attempt.attempt_id} (점수: ${attempt.final_scores})`);
    });
}

console.log('\n=== 분석 완료 ===');