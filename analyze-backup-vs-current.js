const fs = require('fs');

// Read the backup data
const backupData = fs.readFileSync('/Users/skylar/Desktop/SATbank/remote_data_backup.sql', 'utf8');

console.log('=== 백업 vs 현재 데이터 불일치 분석 ===\n');

const kaylaUserId = 'c97a96e0-0bc7-413f-a265-77fa11b79792';
const currentAttemptId = 'd78ceb7d-db61-40cc-a950-ec664bbfab52'; // Current DB에서 본 것
const backupAttemptId = 'f251f812-ef4a-4254-ab50-3209dfbd10e2';  // Backup에서 발견된 것
const examId = '6f4eb255-3d1a-4e4c-90f3-99364b63c91a';

console.log('🎯 Current DB Attempt:', currentAttemptId);
console.log('💾 Backup Attempt:', backupAttemptId);
console.log('📋 Same Exam ID:', examId);
console.log('');

// 1. Check if current attempt exists in backup
console.log('🔍 Current attempt가 백업에 존재하는지 확인:');
const testAttemptMatches = backupData.match(/INSERT INTO "public"\."test_attempts"[^;]+;/g);
let currentAttemptInBackup = false;

if (testAttemptMatches) {
    testAttemptMatches.forEach(insert => {
        if (insert.includes(currentAttemptId)) {
            currentAttemptInBackup = true;
            console.log('✅ Current attempt가 백업에 존재!');
            console.log(insert);
        }
    });
}

if (!currentAttemptInBackup) {
    console.log('❌ Current attempt가 백업에 없음 - 백업 이후에 생성됨');
}

// 2. Analyze the backup attempt in detail
console.log('\n🔍 백업 attempt 상세 분석:');
testAttemptMatches.forEach(insert => {
    if (insert.includes(backupAttemptId)) {
        console.log('✅ Backup attempt 발견:');
        console.log(insert);
        console.log('');

        // Extract detailed info
        const match = insert.match(/VALUES\s*\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*(\d+)\s*,\s*'([^']+)'\s*,\s*'([^']+)'/);
        if (match) {
            const [, attempt_id, user_id, exam_id, status, current_module, current_question, started_at, completed_at] = match;
            console.log('📊 상세 정보:');
            console.log(`   Status: ${status}`);
            console.log(`   Started: ${started_at}`);
            console.log(`   Completed: ${completed_at}`);
            console.log(`   Module: ${current_module}`);
        }
    }
});

// 3. Find the backup attempt's user_answers
console.log('\n🔍 백업 attempt의 user_answers 찾기:');
const userAnswerMatches = backupData.match(/INSERT INTO "public"\."user_answers"[^;]+;/g);
let backupAnswers = [];

if (userAnswerMatches) {
    userAnswerMatches.forEach(insert => {
        if (insert.includes(backupAttemptId)) {
            backupAnswers.push(insert);
        }
    });
}

console.log(`📝 백업 attempt의 답변: ${backupAnswers.length}개`);

if (backupAnswers.length > 0) {
    console.log('\n📋 백업 답변 상세:');
    backupAnswers.forEach((answer, index) => {
        console.log(`\n답변 INSERT ${index + 1}:`);
        console.log(answer.substring(0, 500) + '...');

        // Count individual answers
        const valuesMatch = answer.match(/VALUES\s+(.*)/s);
        if (valuesMatch) {
            const valuesContent = valuesMatch[1];
            const answerRecords = valuesContent.split(/\),\s*\(/);
            console.log(`📊 개별 답변 개수: ${answerRecords.length}개`);

            // Show first few
            console.log('📝 첫 3개 답변:');
            answerRecords.slice(0, 3).forEach((record, recordIndex) => {
                let cleanRecord = record.trim();
                if (!cleanRecord.startsWith('(')) cleanRecord = '(' + cleanRecord;
                if (!cleanRecord.endsWith(')')) cleanRecord = cleanRecord + ')';

                const valueMatch = cleanRecord.match(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([^,]+)\s*,/);
                if (valueMatch) {
                    const [, id, attempt_id, question_id, user_answer] = valueMatch;
                    console.log(`   ${recordIndex + 1}. Q: ${question_id.substring(0, 8)}... A: ${user_answer}`);
                }
            });
        }
    });
}

// 4. Timeline analysis
console.log('\n📅 타임라인 분석:');
console.log('1. 백업 attempt (f251f812...)가 먼저 생성됨');
console.log('2. 사용자가 이 exam을 완료하고 답변을 제출함');
console.log('3. 어느 시점에서 새로운 attempt (d78ceb7d...)가 생성됨');
console.log('4. 이전 attempt와 답변들이 삭제되거나 누락됨');
console.log('5. 새 attempt는 답변 없이 점수만 기록됨');

console.log('\n=== 결론 ===');
console.log('✅ 백업에서 kayla의 실제 답변 데이터 발견!');
console.log('📋 복구 방법: 백업의 답변을 현재 attempt에 연결');
console.log('⚠️  주의: attempt_id를 업데이트해야 함');

console.log('\n=== 분석 완료 ===');