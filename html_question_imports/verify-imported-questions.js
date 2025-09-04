const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Environment setup
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyImportedData() {
  try {
    console.log('🔍 Verifying imported Questions 11 & 12...\n');
    
    // Check Questions 11 and 12 specifically
    const { data: questions, error } = await supabase
      .from('questions')
      .select('question_number, options, correct_answer, question_image_url, question_text, module_type')
      .in('question_number', [11, 12])
      .order('question_number');
      
    if (error) {
      console.error('❌ Database Error:', error);
      return;
    }
    
    if (questions.length === 0) {
      console.log('⚠️ No questions 11 or 12 found in database');
      return;
    }
    
    console.log('=== Imported Questions 11 & 12 Verification ===');
    questions.forEach((q, index) => {
      console.log(`\n📋 Question ${q.question_number}:`);
      console.log(`   Module: ${q.module_type}`);
      console.log(`   Options format: ${typeof q.options}`);
      console.log(`   Options keys: [${Object.keys(q.options || {}).join(', ')}]`);
      console.log(`   Options:`, JSON.stringify(q.options, null, 6));
      console.log(`   Correct answer: ${JSON.stringify(q.correct_answer)}`);
      console.log(`   Image URL present: ${!!q.question_image_url ? '✅' : '❌'}`);
      console.log(`   Image URL: ${q.question_image_url || 'null'}`);
      console.log(`   Question text length: ${q.question_text.length} chars`);
      console.log(`   Text preview: "${q.question_text.slice(0, 150)}..."`);
      console.log(`   Has markdown bold (**): ${q.question_text.includes('**') ? '✅' : '❌'}`);
      console.log(`   Has markdown image (![): ${q.question_text.includes('![') ? '✅' : '❌'}`);
      
      // Check if this is the table question (Q11)
      if (q.question_number === 11) {
        console.log(`   🏆 TABLE QUESTION VERIFICATION:`);
        console.log(`      Contains "Impact of Four Key Industries": ${q.question_text.includes('Impact of Four Key Industries') ? '✅' : '❌'}`);
        console.log(`      Contains "Oklahoma Economy": ${q.question_text.includes('Oklahoma Economy') ? '✅' : '❌'}`);
        console.log(`      Image URL matches table image: ${q.question_image_url?.includes('86626291999171765113') ? '✅' : '❌'}`);
      }
      
      // Check if this is the graph question (Q12)  
      if (q.question_number === 12) {
        console.log(`   📊 GRAPH QUESTION VERIFICATION:`);
        console.log(`      Contains "deforestation": ${q.question_text.includes('deforestation') ? '✅' : '❌'}`);
        console.log(`      Contains "Costa Rica": ${q.question_text.includes('Costa Rica') ? '✅' : '❌'}`);
        console.log(`      Image URL matches graph image: ${q.question_image_url?.includes('08037752661401710982') ? '✅' : '❌'}`);
      }
    });
    
    console.log(`\n🎯 Import verification: ${questions.length}/2 questions found`);
    
    // Overall success check
    const allHaveOptions = questions.every(q => q.options && Object.keys(q.options).length === 4);
    const allHaveCorrectAnswer = questions.every(q => q.correct_answer && Array.isArray(q.correct_answer));
    const allHaveImages = questions.every(q => q.question_image_url && q.question_image_url.startsWith('https://'));
    
    console.log('\n📊 OVERALL SUCCESS METRICS:');
    console.log(`   Options format correct: ${allHaveOptions ? '✅' : '❌'}`);
    console.log(`   Correct answers format: ${allHaveCorrectAnswer ? '✅' : '❌'}`);
    console.log(`   Images present: ${allHaveImages ? '✅' : '❌'}`);
    console.log(`   Success rate: ${questions.length === 2 && allHaveOptions && allHaveCorrectAnswer && allHaveImages ? '100%' : 'Partial'}`);
    
  } catch (err) {
    console.error('💥 Script error:', err);
  }
}

verifyImportedData();