#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFixedImport() {
  const examId = '4803a73f-ce2b-4573-823b-de4f8f4ccb02';
  
  console.log('🔍 Verifying FIXED import results...');
  
  // Get exam details
  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (examError) {
    console.error('❌ Error fetching exam:', examError);
    return;
  }

  console.log('✅ Fixed exam details:');
  console.log(`   • Title: ${exam.title}`);
  console.log(`   • Total Questions: ${exam.total_questions}`);
  console.log(`   • Preview URL: /admin/exams/${exam.id}/preview`);

  // Get first few questions for verification
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
    .in('question_number', [1, 11, 12]) // Check Q1, Q11 (with table), Q12 (with chart)
    .order('question_number', { ascending: true });

  if (questionsError) {
    console.error('❌ Error fetching questions:', questionsError);
    return;
  }

  questions.forEach(q => {
    console.log(`\n📝 Question ${q.question_number}:`);
    console.log(`   • question_text: ${q.question_text ? 'Present (HTML)' : 'Missing'}`);
    console.log(`   • question_html: ${q.question_html ? 'Present (HTML)' : 'Missing'}`);
    console.log(`   • content_format: ${q.content_format}`);
    console.log(`   • options: ${JSON.stringify(q.options)}`);
    console.log(`   • correct_answer: "${q.correct_answer}"`);
    console.log(`   • has image: ${q.question_image_url ? 'Yes' : 'No'}`);
    
    if (q.question_image_url) {
      const imgType = q.question_image_url.startsWith('data:image') ? 'Base64' : 'External URL';
      console.log(`   • image type: ${imgType}`);
      console.log(`   • image preview: ${q.question_image_url.substring(0, 50)}...`);
    }
    
    // Show HTML preview
    if (q.question_html) {
      console.log(`   • HTML preview: ${q.question_html.substring(0, 100)}...`);
    }
  });

  // Verify mapping correctness
  console.log('\n🔍 Verifying answer mapping...');
  const { data: sampleQs, error: sampleError } = await supabase
    .from('questions')
    .select('question_number, options, correct_answer')
    .eq('exam_id', examId)
    .limit(5);

  if (!sampleError && sampleQs) {
    sampleQs.forEach(q => {
      const options = q.options || [];
      const correctAnswer = q.correct_answer;
      const correctOption = options.find(opt => opt.startsWith(correctAnswer + ')'));
      
      console.log(`   • Q${q.question_number}: "${correctAnswer}" → "${correctOption || 'Not found'}"`);
    });
  }

  console.log('\n✅ Fixed import verification completed!');
  console.log(`📋 Ready to test at: /admin/exams/${examId}/preview`);
}

verifyFixedImport();