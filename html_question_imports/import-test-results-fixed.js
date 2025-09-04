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

async function importTestResultsFixed() {
  try {
    console.log('🗑️ First, cleaning up previous import...');
    
    // Delete previous exam
    const { error: deleteError } = await supabase
      .from('exams')
      .delete()
      .eq('id', '31125dd5-bf30-41f1-9512-0e1fe0e628a9');

    if (deleteError && deleteError.code !== 'PGRST116') {
      console.warn('⚠️ Could not delete previous exam:', deleteError);
    } else {
      console.log('✅ Previous exam deleted');
    }

    console.log('📖 Reading HTML cleaning test results...');
    
    // Read the test results file
    const testResultsPath = path.join(__dirname, 'html-cleaning-test-results.json');
    const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
    
    console.log(`✅ Found ${testResults.length} questions to import`);

    // Create exam record
    console.log('📝 Creating exam record...');
    const examData = {
      title: 'HTML Cleaning Test - English Module 1 (Fixed)',
      description: 'Fixed import of cleaned HTML question data with proper field mapping',
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
    console.log('🔄 Preparing questions for import with FIXED mapping...');
    
    const questionsToInsert = testResults.map(question => {
      // Keep original choices format: ["A) text", "B) text", ...]
      const choices = question.choices;
      
      // Extract correct answer letter (A, B, C, D)
      const correctChoiceFull = question.correctAnswer; // e.g., "Looked at"
      const correctLetter = choices.find(choice => 
        choice.substring(3) === correctChoiceFull || choice.includes(correctChoiceFull)
      )?.substring(0, 1); // Get A, B, C, or D

      console.log(`Q${question.questionNumber}: "${correctChoiceFull}" → "${correctLetter || 'A'}"`);

      // Handle images properly
      let imageUrl = null;
      if (question.hasImages && question.imageInfo?.preview) {
        if (question.imageInfo.preview.startsWith('data:image')) {
          imageUrl = question.imageInfo.preview; // Keep base64
        } else if (question.imageInfo.preview.startsWith('http')) {
          imageUrl = question.imageInfo.preview; // Keep external URL
        }
      }

      return {
        exam_id: examRecord.id,
        question_number: question.questionNumber,
        module_type: 'english1', // English Module 1
        question_type: 'multiple_choice',
        question_text: question.cleanedHTML, // Required field, put HTML here too
        question_html: question.cleanedHTML, // Also put HTML in the HTML field
        content_format: 'html', // Specify it's HTML content
        options: choices, // Keep original format: ["A) text", "B) text", ...]
        correct_answer: correctLetter || 'A', // Store as A, B, C, D
        question_image_url: imageUrl,
        // Optional fields set to null
        explanation: null,
        difficulty_level: null,
        topic_tags: null
      };
    });

    console.log('📤 Inserting questions into database...');
    
    // Insert questions in batches of 10 for better error handling
    const batchSize = 10;
    let insertedCount = 0;
    
    for (let i = 0; i < questionsToInsert.length; i += batchSize) {
      const batch = questionsToInsert.slice(i, i + batchSize);
      
      console.log(`📦 Inserting batch ${Math.floor(i/batchSize) + 1} (questions ${i+1}-${Math.min(i+batchSize, questionsToInsert.length)})`);
      
      const { data, error } = await supabase
        .from('questions')
        .insert(batch)
        .select('id, question_number');

      if (error) {
        console.error(`❌ Failed to insert batch ${Math.floor(i/batchSize) + 1}:`, error);
        console.error('Error details:', error.details);
        console.error('Problematic batch sample:', batch.slice(0, 1)); // Show first item
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

    console.log('🎉 Fixed import completed successfully!');
    console.log(`📊 Final stats:`);
    console.log(`   • Exam: "${examRecord.title}"`);
    console.log(`   • Questions imported: ${insertedCount}/${testResults.length}`);
    console.log(`   • Exam ID: ${examRecord.id}`);
    console.log(`   • Preview URL: /admin/exams/${examRecord.id}/preview`);

  } catch (error) {
    console.error('💥 Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importTestResultsFixed();