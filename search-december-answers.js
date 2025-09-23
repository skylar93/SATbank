const fs = require('fs');

// Read the backup data
const backupData = fs.readFileSync('/Users/skylar/Desktop/SATbank/remote_data_backup.sql', 'utf8');

console.log('=== SAT December ATTEMPT 답변 완전 검색 ===\n');

const targetAttemptId = 'd78ceb7d-db61-40cc-a950-ec664bbfab52';
const examId = '6f4eb255-3d1a-4e4c-90f3-99364b63c91a'; // From the attempt data we found

console.log('🎯 Target Attempt ID:', targetAttemptId);
console.log('📋 Exam ID:', examId);
console.log('');

// 1. Search for any user_answers with this attempt_id
console.log('🔍 Target attempt_id로 user_answers 검색:');
const userAnswerMatches = backupData.match(/INSERT INTO "public"\."user_answers"[^;]+;/g);

let foundAnswers = [];
if (userAnswerMatches) {
    userAnswerMatches.forEach(insert => {
        if (insert.includes(targetAttemptId)) {
            foundAnswers.push(insert);
        }
    });
}

console.log(`📝 Target attempt의 답변: ${foundAnswers.length}개`);

if (foundAnswers.length > 0) {
    console.log('\n✅ 백업에서 답변 데이터 발견! 복구 가능합니다!');

    foundAnswers.forEach((answer, index) => {
        console.log(`\n📋 답변 ${index + 1}:`);
        console.log(answer.substring(0, 300) + '...');
    });

    // Extract individual answer records
    foundAnswers.forEach((insert, insertIndex) => {
        console.log(`\n🔍 INSERT ${insertIndex + 1} 상세 분석:`);

        const valuesMatch = insert.match(/VALUES\s+(.*)/s);
        if (valuesMatch) {
            const valuesContent = valuesMatch[1];
            const answerRecords = valuesContent.split(/\),\s*\(/);

            console.log(`📊 총 ${answerRecords.length}개의 개별 답변 발견`);

            // Show first few answer details
            answerRecords.slice(0, 5).forEach((record, recordIndex) => {
                let cleanRecord = record.trim();
                if (!cleanRecord.startsWith('(')) cleanRecord = '(' + cleanRecord;
                if (!cleanRecord.endsWith(')')) cleanRecord = cleanRecord + ')';

                const valueMatch = cleanRecord.match(/\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*([^,]+)\s*,/);
                if (valueMatch) {
                    const [, id, attempt_id, question_id, user_answer] = valueMatch;
                    console.log(`   ${recordIndex + 1}. Q: ${question_id}, A: ${user_answer}`);
                }
            });
        }
    });

} else {
    console.log('\n❌ 백업에도 해당 attempt의 답변 데이터 없음');

    // Search for any user_answers containing the exam_id instead
    console.log('\n🔍 같은 exam_id와 관련된 다른 답변들 찾기:');

    // First find questions for this exam
    const examQuestionMatches = backupData.match(/INSERT INTO "public"\."exam_questions"[^;]+;/g);
    let examQuestions = [];

    if (examQuestionMatches) {
        examQuestionMatches.forEach(insert => {
            if (insert.includes(examId)) {
                // Extract question IDs
                const questionIdMatches = insert.match(/'([a-f0-9-]{36})'/g);
                if (questionIdMatches) {
                    questionIdMatches.forEach(match => {
                        const questionId = match.replace(/'/g, '');
                        if (questionId !== examId && questionId.length === 36) {
                            examQuestions.push(questionId);
                        }
                    });
                }
            }
        });
    }

    console.log(`📋 이 exam의 question 개수: ${examQuestions.length}개`);

    if (examQuestions.length > 0) {
        console.log('📝 첫 5개 question ID:');
        examQuestions.slice(0, 5).forEach((qId, index) => {
            console.log(`   ${index + 1}. ${qId}`);
        });

        // Now search for user_answers with these question IDs
        let relatedAnswers = 0;
        if (userAnswerMatches) {
            userAnswerMatches.forEach(insert => {
                examQuestions.forEach(qId => {
                    if (insert.includes(qId)) {
                        relatedAnswers++;
                    }
                });
            });
        }

        console.log(`\n🔗 이 exam의 question들과 관련된 답변: ${relatedAnswers}개`);
    }
}

console.log('\n=== 검색 완료 ===');