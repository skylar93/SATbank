#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function listExams() {
  console.log('📋 Listing all exams...');
  
  const { data: exams, error } = await supabase
    .from('exams')
    .select('id, title, total_questions, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  exams.forEach((exam, i) => {
    console.log(`${i + 1}. "${exam.title}"`);
    console.log(`   • ID: ${exam.id}`);
    console.log(`   • Questions: ${exam.total_questions}`);
    console.log(`   • Created: ${new Date(exam.created_at).toLocaleString()}`);
    console.log('');
  });

  // Check the HTML Cleaning exam specifically
  const htmlCleaningExam = exams.find(e => e.title.includes('HTML Cleaning'));
  if (htmlCleaningExam) {
    console.log('🔍 Checking HTML Cleaning exam questions...');
    
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('question_number, question_text, options, correct_answer')
      .eq('exam_id', htmlCleaningExam.id)
      .order('question_number')
      .limit(2);

    if (qError) {
      console.error('❌ Error fetching questions:', qError);
      return;
    }

    questions.forEach(q => {
      console.log(`Question ${q.question_number}:`);
      console.log(`   Text: ${q.question_text.substring(0, 80)}...`);
      console.log(`   Options:`, q.options);
      console.log(`   Correct: "${q.correct_answer}"`);
      console.log('');
    });
  }
}

listExams();