#!/usr/bin/env tsx

/**
 * TCF 독해 시험 임포트 스크립트
 *
 * 사용법:
 *   pnpm tsx scripts/import-tcf-exam.ts           # tcf-data/ 폴더 전체 임포트
 *   pnpm tsx scripts/import-tcf-exam.ts tcf_01.json  # 특정 파일만 임포트
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// dotenv v17의 동작 차이 및 워크트리 환경 대응: 파일을 직접 파싱
function loadEnvFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false
  const content = fs.readFileSync(filePath, 'utf-8')
  let loaded = 0
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const raw = trimmed.slice(eqIdx + 1)
    const val = raw.replace(/^["']|["']$/g, '')
    process.env[key] = val
    loaded++
  }
  console.log(`✅ 환경변수 로드 (${loaded}개): ${filePath}`)
  return loaded > 0
}

// 후보 경로 순서대로 시도 (일반 실행 / 워크트리 실행 모두 지원)
const envCandidates = [
  path.resolve(process.cwd(), 'apps/web/.env.local'),               // 레포 루트에서 실행
  path.resolve(process.cwd(), '../../../apps/web/.env.local'),       // 워크트리에서 실행
  path.resolve(process.cwd(), '.env.local'),                         // 루트 .env.local
]
const loaded = envCandidates.some(loadEnvFile)
if (!loaded) {
  console.warn('⚠️ .env.local 파일을 찾지 못했습니다. 시스템 환경변수를 사용합니다.')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// TCF 배점표: 문항 번호 기준
function getPoints(questionNumber: number): number {
  if (questionNumber >= 1 && questionNumber <= 4) return 3
  if (questionNumber >= 5 && questionNumber <= 10) return 9
  if (questionNumber >= 11 && questionNumber <= 19) return 15
  if (questionNumber >= 20 && questionNumber <= 29) return 21
  if (questionNumber >= 30 && questionNumber <= 35) return 26
  if (questionNumber >= 36 && questionNumber <= 39) return 33
  throw new Error(`유효하지 않은 문항 번호: ${questionNumber} (1~39만 허용)`)
}

interface TCFQuestion {
  question_number: number
  question_text: string
  image_url?: string | null
  options: { A: string; B: string; C: string; D: string }
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation?: string
}

interface TCFExamFile {
  exam_title: string
  description?: string
  time_limit_minutes?: number
  questions: TCFQuestion[]
}

// Returns: 'imported' | 'skipped' | 'error'
async function importTCFExam(filePath: string): Promise<'imported' | 'skipped' | 'error'> {
  const fileName = path.basename(filePath)
  console.log(`\n📂 처리 중: ${fileName}`)

  // JSON 파일 읽기
  let examData: TCFExamFile
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    examData = JSON.parse(raw)
  } catch (e) {
    console.error(`  ❌ JSON 파싱 실패: ${e}`)
    return 'error'
  }

  const { exam_title, description = '', time_limit_minutes = 60, questions } = examData

  // 기본 검증
  if (!exam_title) {
    console.error('  ❌ exam_title이 없습니다')
    return 'error'
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    console.error('  ❌ questions 배열이 비어 있습니다')
    return 'error'
  }
  if (questions.length !== 39) {
    console.warn(`  ⚠️ 문항 수 경고: ${questions.length}개 (예상: 39개)`)
  }

  // 중복 체크
  const { data: existing } = await supabase
    .from('exams')
    .select('id, title')
    .eq('title', exam_title)
    .maybeSingle()

  if (existing) {
    console.log(`  ⏭️ 스킵: "${exam_title}" 이미 존재 (id: ${existing.id})`)
    return 'skipped'
  }

  // 배점 계산 미리 검증
  for (const q of questions) {
    if (!q.question_number || !q.question_text || !q.options || !q.correct_answer) {
      console.error(`  ❌ 문항 ${q.question_number} 데이터 누락`)
      return 'error'
    }
    if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
      console.error(`  ❌ 문항 ${q.question_number} correct_answer 오류: "${q.correct_answer}"`)
      return 'error'
    }
    getPoints(q.question_number) // 범위 오류시 throw
  }

  // 최대 가능 점수 계산
  const maxScore = questions.reduce((sum, q) => sum + getPoints(q.question_number), 0)
  console.log(`  📊 예상 최대 점수: ${maxScore}점 / 699점`)

  // 1. exam 레코드 삽입
  const { data: examRecord, error: examError } = await supabase
    .from('exams')
    .insert({
      title: exam_title,
      description: description || null,
      is_mock_exam: true,
      is_active: true,
      total_questions: questions.length,
      time_limits: { tcf_reading: time_limit_minutes },
      template_id: 'tcf_reading_only',
    })
    .select('id')
    .single()

  if (examError || !examRecord) {
    console.error(`  ❌ exam 삽입 실패: ${examError?.message}`)
    return 'error'
  }

  console.log(`  ✅ exam 생성: ${examRecord.id}`)

  // 2. questions 일괄 삽입
  const questionRows = questions.map((q) => ({
    exam_id: examRecord.id,
    module_type: 'tcf_reading' as const,
    question_number: q.question_number,
    question_type: 'multiple_choice' as const,
    difficulty_level: 'medium' as const,
    question_markdown_backup: q.question_text,
    options_markdown_backup: q.options,
    question_text: q.question_text,
    question_image_url: q.image_url || null,
    options: q.options,
    correct_answer: q.correct_answer,
    correct_answers: null,
    explanation: q.explanation || null,
    points: getPoints(q.question_number),
  }))

  const { error: qError } = await supabase.from('questions').insert(questionRows)

  if (qError) {
    // 롤백: 방금 만든 exam 삭제
    await supabase.from('exams').delete().eq('id', examRecord.id)
    console.error(`  ❌ questions 삽입 실패 (exam 롤백됨): ${qError.message}`)
    return 'error'
  }

  console.log(`  ✅ 문항 ${questionRows.length}개 삽입 완료`)
  console.log(`  🎉 "${exam_title}" 임포트 성공`)
  return 'imported'
}

async function main() {
  // 워크트리 또는 메인 레포 양쪽 모두 지원
  const dataDirCandidates = [
    path.resolve(process.cwd(), 'scripts/tcf-data'),          // 워크트리/레포 루트
    path.resolve(process.cwd(), '../../../scripts/tcf-data'),  // 워크트리에서 메인 레포
  ]
  const dataDir = dataDirCandidates.find(fs.existsSync) ?? dataDirCandidates[0]

  // 특정 파일 지정 or 전체 폴더
  const specificFile = process.argv[2]

  if (specificFile) {
    const filePath = path.resolve(dataDir, specificFile)
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 파일 없음: ${filePath}`)
      process.exit(1)
    }
    await importTCFExam(filePath)
  } else {
    if (!fs.existsSync(dataDir)) {
      console.error(`❌ 디렉터리 없음: ${dataDir}`)
      console.log('  → scripts/tcf-data/ 폴더를 만들고 JSON 파일을 넣어주세요.')
      process.exit(1)
    }

    const files = fs
      .readdirSync(dataDir)
      .filter((f) => f.endsWith('.json'))
      .sort()

    if (files.length === 0) {
      console.log('⚠️ scripts/tcf-data/ 에 JSON 파일이 없습니다.')
      process.exit(0)
    }

    console.log(`📋 총 ${files.length}개 파일 처리 시작`)
    let imported = 0
    let skipped = 0
    let errors = 0

    for (const file of files) {
      const result = await importTCFExam(path.join(dataDir, file))
      if (result === 'imported') imported++
      else if (result === 'skipped') skipped++
      else errors++
    }

    console.log(`\n✅ 완료: 임포트 ${imported}개, 스킵 ${skipped}개, 오류 ${errors}개`)
  }
}

main().catch((e) => {
  console.error('💥 치명적 오류:', e)
  process.exit(1)
})
