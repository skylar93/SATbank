const fs = require('fs');

// Read the backup data
const backupData = fs.readFileSync('/Users/skylar/Desktop/SATbank/remote_data_backup.sql', 'utf8');

console.log('=== 상세한 KAYLA 데이터 검색 ===\n');

// 1. Search for any mention of kayla (case insensitive)
console.log('🔍 모든 "kayla" 언급 찾기:');
const kaylaLines = backupData.split('\n').filter(line =>
    line.toLowerCase().includes('kayla')
);
console.log(`총 ${kaylaLines.length}개 라인에서 kayla 발견`);
kaylaLines.forEach((line, index) => {
    console.log(`${index + 1}. ${line.trim()}`);
});

// 2. Search for the specific user ID we saw in current data
console.log('\n🔍 알려진 user_id로 검색:');
const userIdLines = backupData.split('\n').filter(line =>
    line.includes('63dc269e-6b89-4a2f-9c5d-1e7a8b3f4c9d')
);
console.log(`user_id로 ${userIdLines.length}개 라인 발견`);
userIdLines.forEach((line, index) => {
    console.log(`${index + 1}. ${line.trim()}`);
});

// 3. Search for any test_attempts with this pattern
console.log('\n🔍 test_attempts 패턴 검색:');
const attemptPattern = /INSERT INTO "public"\."test_attempts".*VALUES.*\('([^']+)'.*'([^']+)'.*'([^']+)'/g;
let match;
let attemptCount = 0;
while ((match = attemptPattern.exec(backupData)) !== null) {
    attemptCount++;
    if (attemptCount <= 10) { // Show first 10 attempts
        console.log(`${attemptCount}. attempt_id: ${match[1]}, user_id: ${match[2]}, exam_id: ${match[3]}`);
    }
}
console.log(`총 ${attemptCount}개의 test_attempts 발견`);

// 4. Check if backup file is complete
console.log('\n📊 백업 파일 완성도 체크:');
console.log(`파일 크기: ${Math.round(backupData.length / 1024)} KB`);
console.log(`총 라인 수: ${backupData.split('\n').length}`);
console.log(`INSERT 문 개수: ${(backupData.match(/INSERT INTO/g) || []).length}`);

console.log('\n=== 검색 완료 ===');