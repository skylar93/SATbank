#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugImport() {
  console.log('🔍 Debugging imported data...');
  
  const { data: questions, error } = await supabase
    .from('questions')
    .select('*')
    .eq('question_number', 1)
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (questions.length === 0) {
    console.log('❌ No question found');
    return;
  }

  const q = questions[0];
  console.log('📝 Question 1 debug info:');
  console.log(`   • question_text: ${q.question_text.substring(0, 100)}...`);
  console.log(`   • options:`, q.options);
  console.log(`   • correct_answer: "${q.correct_answer}"`);
  console.log(`   • question_image_url: ${q.question_image_url ? 'Has image data (length: ' + q.question_image_url.length + ')' : 'No image'}`);

  // Check question 12 specifically
  const { data: q12, error: q12Error } = await supabase
    .from('questions')
    .select('*')
    .eq('question_number', 12)
    .limit(1);

  if (q12 && q12[0]) {
    console.log('\n📝 Question 12 debug info:');
    console.log(`   • question_text: ${q12[0].question_text.substring(0, 100)}...`);
    console.log(`   • Has question_image_url: ${q12[0].question_image_url ? 'Yes' : 'No'}`);
    if (q12[0].question_image_url) {
      console.log(`   • Image URL type: ${q12[0].question_image_url.startsWith('data:image') ? 'Base64' : 'External URL'}`);
      console.log(`   • Image URL preview: ${q12[0].question_image_url.substring(0, 50)}...`);
    }
  }

  // Check original test data for comparison
  console.log('\n📖 Checking original test data...');
  const fs = require('fs');
  const testData = JSON.parse(fs.readFileSync(path.join(__dirname, 'html-cleaning-test-results.json'), 'utf8'));
  
  const originalQ1 = testData[0];
  const originalQ12 = testData.find(q => q.questionNumber === 12);
  
  console.log('\n🔍 Original data comparison:');
  console.log(`   • Q1 choices: ${JSON.stringify(originalQ1.choices)}`);
  console.log(`   • Q1 correct answer: "${originalQ1.correctAnswer}"`);
  
  if (originalQ12) {
    console.log(`   • Q12 has image: ${originalQ12.hasImages}`);
    console.log(`   • Q12 image info: ${originalQ12.imageInfo ? 'Present' : 'Missing'}`);
    if (originalQ12.imageInfo) {
      console.log(`   • Q12 image types: ${JSON.stringify(originalQ12.imageInfo.types)}`);
    }
  }
}

debugImport();