const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://eoyzqdsxlweygsukjnef.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI4NDI4MSwiZXhwIjoyMDY3ODYwMjgxfQ.A_K81bklI-TkCrhWzElzDH86wrIveEQ1-hzDwM8ByNQ'

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function debugExamQuestions() {
  const examId = 'b5a9167b-27bb-419c-98bb-b9b09416cbed'
  
  console.log('🔍 Debugging exam questions for exam ID:', examId)
  
  // Check if exam exists
  console.log('\n1. Checking if exam exists...')
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single()
  
  if (examError) {
    console.error('❌ Exam query error:', examError)
    return
  }
  
  console.log('✅ Exam found:', exam.title)
  
  // Check direct questions for each module
  const modules = ['english1', 'english2', 'math1', 'math2']
  
  for (const moduleType of modules) {
    console.log(`\n2. Checking direct questions for ${moduleType}...`)
    
    const { data: directQuestions, error: directError } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', examId)
      .eq('module_type', moduleType)
      .order('question_number', { ascending: true })
    
    if (directError) {
      console.error(`❌ Direct questions error for ${moduleType}:`, directError)
      continue
    }
    
    console.log(`✅ Direct questions for ${moduleType}:`, directQuestions?.length || 0)
    
    if (directQuestions && directQuestions.length === 0) {
      // Try linked questions
      console.log(`3. Checking linked questions for ${moduleType}...`)
      
      const { data: linkedQuestions, error: linkedError } = await supabase
        .from('exam_questions')
        .select(`
          questions!inner (*)
        `)
        .eq('exam_id', examId)
        .eq('questions.module_type', moduleType)
      
      if (linkedError) {
        console.error(`❌ Linked questions error for ${moduleType}:`, linkedError)
        continue
      }
      
      console.log(`✅ Linked questions for ${moduleType}:`, linkedQuestions?.length || 0)
    }
  }
  
  // Check if there are any questions at all for this exam
  console.log('\n4. Checking all questions for this exam...')
  const { data: allQuestions, error: allError } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
  
  if (allError) {
    console.error('❌ All questions error:', allError)
  } else {
    console.log('✅ Total questions found:', allQuestions?.length || 0)
    if (allQuestions && allQuestions.length > 0) {
      console.log('Module distribution:')
      const distribution = allQuestions.reduce((acc, q) => {
        acc[q.module_type] = (acc[q.module_type] || 0) + 1
        return acc
      }, {})
      console.log(distribution)
    }
  }
  
  // Check exam_questions table
  console.log('\n5. Checking exam_questions table...')
  const { data: examQuestions, error: examQuestionsError } = await supabase
    .from('exam_questions')
    .select('*')
    .eq('exam_id', examId)
  
  if (examQuestionsError) {
    console.error('❌ Exam questions table error:', examQuestionsError)
  } else {
    console.log('✅ Exam questions links:', examQuestions?.length || 0)
  }
  
  // Check if there are ANY questions at all in the database
  console.log('\n6. Checking if there are any questions in the database...')
  const { data: anyQuestions, error: anyError, count } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
  
  if (anyError) {
    console.error('❌ Questions count error:', anyError)
  } else {
    console.log('✅ Total questions in database:', count || 0)
  }
  
  // Check recent questions (last 50)
  console.log('\n7. Checking recent questions...')
  const { data: recentQuestions, error: recentError } = await supabase
    .from('questions')
    .select('id, exam_id, module_type, question_number, created_at')
    .order('created_at', { ascending: false })
    .limit(10)
  
  if (recentError) {
    console.error('❌ Recent questions error:', recentError)
  } else {
    console.log('✅ Recent questions:')
    recentQuestions?.forEach(q => {
      console.log(`   - ${q.id}: ${q.exam_id} | ${q.module_type} | Q${q.question_number} | ${q.created_at}`)
    })
  }
}

debugExamQuestions().catch(console.error)