#!/usr/bin/env node

// Debug script to test English Module 1 loading
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './apps/web/.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugEnglish1Loading() {
  try {
    console.log('🔍 Debugging English Module 1 loading issue...\n')

    // 1. Check how many english1 questions exist in total
    console.log('1. Checking total english1 questions in database:')
    const { data: allEnglish1Questions, error: allError } = await supabase
      .from('questions')
      .select('*')
      .eq('module_type', 'english1')

    if (allError) {
      console.error('❌ Error fetching all english1 questions:', allError)
    } else {
      console.log(`✅ Found ${allEnglish1Questions?.length || 0} english1 questions in database\n`)
    }

    // 2. Find exams that specifically have English1 in their title
    console.log('2. Checking for English1 exams:')
    const { data: english1Exams, error: examError } = await supabase
      .from('exams')
      .select('id, title, is_active')
      .eq('is_active', true)
      .ilike('title', '%english1%')

    if (examError) {
      console.error('❌ Error fetching english1 exams:', examError)
    } else {
      console.log(`✅ Found ${english1Exams?.length || 0} exams with "english1" in title:`)
      english1Exams?.slice(0, 10).forEach(exam => {
        console.log(`   - ${exam.title} (ID: ${exam.id})`)
      })
      console.log('')
    }

    // 3. Test the getQuestions logic for the first english1 exam
    if (english1Exams && english1Exams.length > 0) {
      const testExam = english1Exams[0]
      console.log(`3. Testing getQuestions for exam: ${testExam.title}`)

      // Test direct questions first
      console.log('   a) Testing direct questions:')
      const { data: directQuestions, error: directError } = await supabase
        .from('questions')
        .select('*')
        .eq('exam_id', testExam.id)
        .eq('module_type', 'english1')
        .order('question_number', { ascending: true })

      if (directError) {
        console.error('   ❌ Error with direct questions:', directError)
      } else {
        console.log(`   ✅ Direct questions: ${directQuestions?.length || 0}`)
        if (directQuestions && directQuestions.length > 0) {
          console.log('   📝 First few direct questions:')
          directQuestions.slice(0, 3).forEach((question, index) => {
            console.log(`      ${index + 1}. Q${question.question_number}: ${question.question_text?.substring(0, 60)}...`)
          })
        }
      }

      // Test linked questions
      console.log('   b) Testing linked questions:')
      const { data: linkedQuestions, error: linkedError } = await supabase
        .from('exam_questions')
        .select(`
          questions!inner (*)
        `)
        .eq('exam_id', testExam.id)
        .eq('questions.module_type', 'english1')

      if (linkedError) {
        console.error('   ❌ Error with linked questions:', linkedError)
      } else {
        console.log(`   ✅ Linked questions: ${linkedQuestions?.length || 0}`)
        if (linkedQuestions && linkedQuestions.length > 0) {
          console.log('   📝 First few linked questions:')
          linkedQuestions.slice(0, 3).forEach((item, index) => {
            const question = item.questions
            console.log(`      ${index + 1}. Q${question.question_number}: ${question.question_text?.substring(0, 60)}...`)
          })
        }
      }

      // Total for this exam
      const totalQuestions = (directQuestions?.length || 0) + (linkedQuestions?.length || 0)
      console.log(`   🎯 Total english1 questions for "${testExam.title}": ${totalQuestions}\n`)

      // 4. If no questions found, check what's in exam_questions table for this exam
      if (totalQuestions === 0) {
        console.log('4. Checking exam_questions table for this exam:')
        const { data: examQuestionsAll, error: eqError } = await supabase
          .from('exam_questions')
          .select('*')
          .eq('exam_id', testExam.id)

        if (eqError) {
          console.error('   ❌ Error fetching exam_questions:', eqError)
        } else {
          console.log(`   ✅ Found ${examQuestionsAll?.length || 0} entries in exam_questions for this exam`)
          if (examQuestionsAll && examQuestionsAll.length > 0) {
            const moduleTypes = [...new Set(examQuestionsAll.map(eq => eq.module_type))]
            console.log('   📊 Module types found:', moduleTypes)

            // Check if questions exist for those question_ids
            const questionIds = examQuestionsAll.map(eq => eq.question_id)
            const { data: questionsCheck, error: qcError } = await supabase
              .from('questions')
              .select('id, module_type')
              .in('id', questionIds)

            if (qcError) {
              console.error('   ❌ Error checking questions:', qcError)
            } else {
              console.log(`   ✅ Found ${questionsCheck?.length || 0} actual questions for these IDs`)
              const actualModuleTypes = [...new Set(questionsCheck?.map(q => q.module_type) || [])]
              console.log('   📊 Actual module types in questions table:', actualModuleTypes)
            }
          }
        }
      }
    } else {
      console.log('No English1 exams found to test with.')
    }

    // 5. Check exam assignments
    console.log('5. Checking exam assignments:')
    const { data: assignments, error: assignmentError } = await supabase
      .from('exam_assignments')
      .select(`
        id,
        exam_id,
        student_id,
        is_active,
        exams (title)
      `)
      .eq('is_active', true)

    if (assignmentError) {
      console.error('❌ Error fetching assignments:', assignmentError)
    } else {
      console.log(`✅ Found ${assignments?.length || 0} active assignments`)
      assignments?.slice(0, 5).forEach(assignment => {
        console.log(`   - Student: ${assignment.student_id.substring(0, 8)}... → Exam: ${assignment.exams?.title}`)
      })
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

debugEnglish1Loading()