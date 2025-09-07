#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: './apps/web/.env.local' })

const EXAM_ID = '22744096-2398-4af4-bbfa-6a0cbd4abdea'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for debugging

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'SET' : 'MISSING')
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'SET' : 'MISSING')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function testDatabaseConnection() {
  console.log('🔍 Starting database connection debug...')
  console.log('📋 Exam ID:', EXAM_ID)
  console.log('')

  try {
    // Test 1: Basic connection test
    console.log('=== TEST 1: Basic Connection Test ===')
    const { data: connectionTest, error: connectionError } = await supabase
      .from('exams')
      .select('count(*)')
      .limit(1)
    
    if (connectionError) {
      console.error('❌ Connection failed:', connectionError)
      return
    }
    console.log('✅ Database connection successful')
    console.log('')

    // Test 2: Check if the exam exists
    console.log('=== TEST 2: Check Exam Exists ===')
    const { data: examData, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', EXAM_ID)
      .single()
    
    if (examError) {
      console.error('❌ Exam query failed:', examError)
      return
    }
    
    if (!examData) {
      console.error('❌ Exam not found')
      return
    }
    
    console.log('✅ Exam found:', {
      id: examData.id,
      title: examData.title,
      is_active: examData.is_active,
      total_questions: examData.total_questions
    })
    console.log('')

    // Test 3: Check exam_questions table
    console.log('=== TEST 3: Check exam_questions Table ===')
    const { data: examQuestionsData, error: examQuestionsError } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', EXAM_ID)
    
    if (examQuestionsError) {
      console.error('❌ exam_questions query failed:', examQuestionsError)
      return
    }
    
    console.log(`✅ Found ${examQuestionsData?.length || 0} rows in exam_questions`)
    
    // Group by module type
    const moduleGroups = examQuestionsData?.reduce((acc, item) => {
      const module = item.module_type
      acc[module] = (acc[module] || 0) + 1
      return acc
    }, {}) || {}
    
    console.log('📊 exam_questions by module:', moduleGroups)
    
    // Sample a few entries
    if (examQuestionsData && examQuestionsData.length > 0) {
      console.log('🔍 Sample exam_questions entries:')
      examQuestionsData.slice(0, 3).forEach(item => {
        console.log(`  - question_id: ${item.question_id}, module: ${item.module_type}`)
      })
    }
    console.log('')

    // Test 4: Check questions table
    console.log('=== TEST 4: Check questions Table ===')
    const questionIds = examQuestionsData?.map(eq => eq.question_id) || []
    
    if (questionIds.length === 0) {
      console.log('⚠️  No question IDs to check')
    } else {
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('id, module_type, question_number, question_type, exam_id')
        .in('id', questionIds.slice(0, 10)) // Check first 10
      
      if (questionsError) {
        console.error('❌ questions query failed:', questionsError)
        return
      }
      
      console.log(`✅ Found ${questionsData?.length || 0} matching questions out of ${Math.min(questionIds.length, 10)} checked`)
      
      if (questionsData && questionsData.length > 0) {
        console.log('🔍 Sample questions entries:')
        questionsData.slice(0, 3).forEach(q => {
          console.log(`  - id: ${q.id}, module: ${q.module_type}, #${q.question_number}, exam_id: ${q.exam_id}`)
        })
      }
    }
    console.log('')

    // Test 5: Test the JOIN query (the failing one)
    console.log('=== TEST 5: Test JOIN Query (english1) ===')
    const { data: joinData, error: joinError } = await supabase
      .from('exam_questions')
      .select(`
        questions!inner (*)
      `)
      .eq('exam_id', EXAM_ID)
      .eq('module_type', 'english1')
    
    if (joinError) {
      console.error('❌ JOIN query failed:', joinError)
      console.error('Full error details:', JSON.stringify(joinError, null, 2))
    } else {
      console.log(`✅ JOIN query successful: ${joinData?.length || 0} results`)
      if (joinData && joinData.length > 0) {
        console.log('🔍 Sample JOIN results:')
        joinData.slice(0, 2).forEach((item, index) => {
          console.log(`  Result ${index + 1}:`, {
            questions: item.questions ? {
              id: item.questions.id,
              module_type: item.questions.module_type,
              question_number: item.questions.question_number
            } : null
          })
        })
      }
    }
    console.log('')

    // Test 6: Alternative JOIN syntax
    console.log('=== TEST 6: Alternative JOIN Syntax ===')
    const { data: altJoinData, error: altJoinError } = await supabase
      .from('exam_questions')
      .select(`
        question_id,
        module_type,
        questions (
          id,
          module_type,
          question_number,
          question_text,
          exam_id
        )
      `)
      .eq('exam_id', EXAM_ID)
      .eq('module_type', 'english1')
    
    if (altJoinError) {
      console.error('❌ Alternative JOIN failed:', altJoinError)
    } else {
      console.log(`✅ Alternative JOIN successful: ${altJoinData?.length || 0} results`)
      if (altJoinData && altJoinData.length > 0) {
        console.log('🔍 Sample alternative JOIN results:')
        altJoinData.slice(0, 2).forEach((item, index) => {
          console.log(`  Result ${index + 1}:`, {
            question_id: item.question_id,
            module_type: item.module_type,
            questions: item.questions ? {
              id: item.questions.id,
              question_number: item.questions.question_number,
              exam_id: item.questions.exam_id
            } : 'NULL'
          })
        })
      }
    }
    console.log('')

    // Test 7: Check for foreign key relationship issues
    console.log('=== TEST 7: Check Foreign Key Relationships ===')
    if (questionIds.length > 0) {
      const sampleQuestionId = questionIds[0]
      console.log(`🔍 Checking question ID: ${sampleQuestionId}`)
      
      const { data: questionCheck, error: questionCheckError } = await supabase
        .from('questions')
        .select('*')
        .eq('id', sampleQuestionId)
        .single()
      
      if (questionCheckError) {
        console.error('❌ Question check failed:', questionCheckError)
      } else if (!questionCheck) {
        console.error('❌ Question not found in questions table')
      } else {
        console.log('✅ Sample question found:', {
          id: questionCheck.id,
          module_type: questionCheck.module_type,
          exam_id: questionCheck.exam_id,
          question_number: questionCheck.question_number
        })
        
        // Check if exam_id matches
        if (questionCheck.exam_id !== EXAM_ID) {
          console.log(`⚠️  Question's exam_id (${questionCheck.exam_id}) doesn't match our exam (${EXAM_ID})`)
        } else {
          console.log('✅ Question\'s exam_id matches')
        }
      }
    }

    // Test 8: Test RLS policies
    console.log('\n=== TEST 8: Check RLS Policies ===')
    console.log('🔍 Testing with anon key (simulating frontend)...')
    
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const anonSupabase = createClient(supabaseUrl, anonKey)
    
    const { data: anonJoinData, error: anonJoinError } = await anonSupabase
      .from('exam_questions')
      .select(`
        questions!inner (*)
      `)
      .eq('exam_id', EXAM_ID)
      .eq('module_type', 'english1')
    
    if (anonJoinError) {
      console.error('❌ Anon JOIN query failed (RLS might be blocking):', anonJoinError)
      console.log('This suggests RLS policies are preventing anonymous access')
    } else {
      console.log(`✅ Anon JOIN query successful: ${anonJoinData?.length || 0} results`)
      console.log('RLS policies allow anonymous access to this data')
    }

    console.log('\n🎯 Debug Summary Complete!')

  } catch (error) {
    console.error('💥 Unexpected error:', error)
  }
}

testDatabaseConnection()