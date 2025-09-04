#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyImport() {
  console.log('🔍 Verifying import results...');
  
  // Find our imported exam
  const { data: exams, error: examsError } = await supabase
    .from('exams')
    .select('*')
    .ilike('title', '%HTML Cleaning%')
    .order('created_at', { ascending: false });

  if (examsError) {
    console.error('❌ Error fetching exams:', examsError);
    return;
  }

  if (!exams || exams.length === 0) {
    console.log('❌ No imported exams found');
    return;
  }

  const exam = exams[0];
  console.log('✅ Found imported exam:');
  console.log(`   • Title: ${exam.title}`);
  console.log(`   • ID: ${exam.id}`);
  console.log(`   • Total Questions: ${exam.total_questions}`);
  console.log(`   • Time Limits:`, exam.time_limits);
  console.log(`   • Created: ${new Date(exam.created_at).toLocaleString()}`);

  // Get questions for this exam
  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('exam_id', exam.id)
    .order('question_number', { ascending: true });

  if (questionsError) {
    console.error('❌ Error fetching questions:', questionsError);
    return;
  }

  console.log(`\n📋 Questions imported: ${questions.length}`);
  
  if (questions.length > 0) {
    const firstQuestion = questions[0];
    console.log('\n📝 Sample question (first):');
    console.log(`   • Number: ${firstQuestion.question_number}`);
    console.log(`   • Module: ${firstQuestion.module_type}`);
    console.log(`   • Type: ${firstQuestion.question_type}`);
    console.log(`   • Text length: ${firstQuestion.question_text?.length || 0} chars`);
    console.log(`   • Options: ${JSON.stringify(firstQuestion.options)}`);
    console.log(`   • Correct Answer: ${firstQuestion.correct_answer}`);
    console.log(`   • Has Image: ${firstQuestion.question_image_url ? 'Yes' : 'No'}`);

    // Check for any potential issues
    const issues = [];
    questions.forEach((q, i) => {
      if (!q.question_text) issues.push(`Question ${q.question_number}: Missing text`);
      if (!q.options || q.options.length !== 4) issues.push(`Question ${q.question_number}: Invalid options`);
      if (!q.correct_answer) issues.push(`Question ${q.question_number}: Missing correct answer`);
      if (q.module_type !== 'english1') issues.push(`Question ${q.question_number}: Wrong module type`);
    });

    if (issues.length > 0) {
      console.log('\n⚠️ Issues found:');
      issues.slice(0, 5).forEach(issue => console.log(`   • ${issue}`));
      if (issues.length > 5) {
        console.log(`   • ... and ${issues.length - 5} more issues`);
      }
    } else {
      console.log('\n✅ All questions look good!');
    }
  }

  console.log('\n🎯 Import verification completed');
}

verifyImport();