#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../apps/web/.env.local') });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importTestResults() {
  try {
    console.log('📖 Reading HTML cleaning test results...');
    
    // Read the test results file
    const testResultsPath = path.join(__dirname, 'html-cleaning-test-results.json');
    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
    
    console.log(`✅ Found ${testResults.length} questions to import`);

    // Create exam record
    console.log('📝 Creating exam record...');
    const examData = {
      title: 'Test HTML Cleaning Results - English Module 1',
      description: 'Test import of cleaned HTML question data',
      time_limits: { 
        english1: 64,  // 64 minutes for English module 1
        english2: 35,  // Default values for other modules
        math1: 35,
        math2: 55 
      },
      total_questions: testResults.length,
      is_active: true,
      is_mock_exam: false,  // This is a test, not a mock exam
      is_custom_assignment: false,
      answer_check_mode: 'exam_end'
    };

    const { data: examRecord, error: examError } = await supabase
      .from('exams')
      .insert([examData])
      .select()
      .single();

    if (examError) {
      console.error('❌ Failed to create exam:', examError);
      return;
    }

    console.log('✅ Created exam:', examRecord.title);
    console.log('🆔 Exam ID:', examRecord.id);

    // Prepare questions for batch insert
    console.log('🔄 Preparing questions for import...');
    
    const questionsToInsert = testResults.map(question => {
      // Extract choices from the format "A) choice text"
      const choices = question.choices.map(choice => {
        const match = choice.match(/^[A-D]\)\s*(.+)$/);
        return match ? match[1] : choice;
      });

      return {
        exam_id: examRecord.id,
        question_number: question.questionNumber,
        module_type: 'english1', // English Module 1
        question_type: 'multiple_choice',
        question_text: question.cleanedHTML,
        options: choices, // JSONB array of just the choice text
        correct_answer: question.correctAnswer,
        question_image_url: question.imageInfo?.preview?.startsWith('data:image') 
          ? question.imageInfo.preview 
          : null,
        // Optional fields set to null
        explanation: null,
        difficulty_level: null,
        topic_tags: null
      };
    });

    console.log('📤 Inserting questions into database...');
    
    // Insert questions in batches of 50
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('questions')
        .insert(batch)
        .select('id');

      if (error) {
        console.error(`❌ Failed to insert batch ${Math.floor(i/batchSize) + 1}:`, error);
        console.error('Error details:', error.details);
        console.error('Problematic batch:', batch.slice(0, 2)); // Show first 2 items
        continue;
      }

      insertedCount += data.length;
      console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${data.length} questions`);
    }

    // Update exam with final question count
    const { error: updateError } = await supabase
      .from('exams')
      .update({ total_questions: insertedCount })
      .eq('id', examRecord.id);

    if (updateError) {
      console.warn('⚠️ Failed to update exam question count:', updateError);
    }

    console.log('🎉 Import completed successfully!');
    console.log(`📊 Final stats:`);
    console.log(`   • Exam: "${examRecord.title}"`);
    console.log(`   • Questions imported: ${insertedCount}/${testResults.length}`);
    console.log(`   • Exam ID: ${examRecord.id}`);

  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importTestResults();