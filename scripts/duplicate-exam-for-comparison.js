#!/usr/bin/env node

/**
 * Duplicate Exam for HTML Comparison Script
 * Creates a duplicate exam for side-by-side comparison of Markdown vs HTML conversion
 * 
 * Usage: node scripts/duplicate-exam-for-comparison.js <original_exam_id>
 * Example: node scripts/duplicate-exam-for-comparison.js 6f4eb255-3d1a-4e4c-90f3-99364b63c91a
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function duplicateExamForComparison() {
  const originalExamId = process.argv[2];
  if (!originalExamId) {
    console.error('❌ Please provide the original exam_id to duplicate.');
    console.error('Usage: node scripts/duplicate-exam-for-comparison.js <original_exam_id>');
    process.exit(1);
  }

  console.log(`🔄 Creating duplicate exam for HTML comparison: ${originalExamId}`);

  try {
    // Step 1: Get original exam info
    const { data: originalExam, error: examError } = await supabase
      .from('exams')
      .select('*')
      .eq('id', originalExamId)
      .single();

    if (examError || !originalExam) {
      console.error('❌ Failed to fetch original exam:', examError?.message || 'Exam not found');
      process.exit(1);
    }

    console.log(`📚 Original exam: "${originalExam.title}"`);

    // Step 2: Create duplicate exam
    const { data: duplicateExam, error: createExamError } = await supabase
      .from('exams')
      .insert({
        title: `${originalExam.title} - HTML Comparison`,
        description: `HTML comparison version of: ${originalExam.description || originalExam.title}`,
        duration: originalExam.duration,
        total_questions: originalExam.total_questions,
        created_by: originalExam.created_by,
        is_active: false // Set to inactive so students don't see it
      })
      .select()
      .single();

    if (createExamError) {
      console.error('❌ Failed to create duplicate exam:', createExamError.message);
      process.exit(1);
    }

    const newExamId = duplicateExam.id;
    console.log(`✅ Created duplicate exam: ${newExamId}`);
    console.log(`📝 Title: "${duplicateExam.title}"`);

    // Step 3: Get all questions from original exam
    const { data: originalQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('exam_id', originalExamId)
      .order('question_number');

    if (questionsError) {
      console.error('❌ Failed to fetch original questions:', questionsError.message);
      process.exit(1);
    }

    console.log(`📝 Found ${originalQuestions.length} questions to duplicate`);

    // Step 4: Duplicate all questions
    const questionsToInsert = originalQuestions.map(q => ({
      exam_id: newExamId,
      question_number: q.question_number,
      module_type: q.module_type,
      question_type: q.question_type,
      // Keep original markdown versions
      question_text: q.question_markdown_backup || q.question_text,
      options: q.options_markdown_backup || q.options,
      explanation: q.explanation_markdown_backup || q.explanation,
      // Copy backup columns too
      question_markdown_backup: q.question_markdown_backup || q.question_text,
      options_markdown_backup: q.options_markdown_backup || q.options,
      explanation_markdown_backup: q.explanation_markdown_backup || q.explanation,
      // Clear HTML columns initially
      question_html: null,
      options_html: null,
      explanation_html: null,
      html_migration_status: 'pending',
      // Copy other fields
      correct_answer: q.correct_answer,
      correct_answers: q.correct_answers,
      difficulty_level: q.difficulty_level,
      topic_tags: q.topic_tags,
      question_image_url: q.question_image_url,
      table_data: q.table_data
    }));

    const { data: insertedQuestions, error: insertError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select('id');

    if (insertError) {
      console.error('❌ Failed to duplicate questions:', insertError.message);
      process.exit(1);
    }

    console.log(`✅ Successfully duplicated ${insertedQuestions.length} questions`);

    // Step 5: Summary
    console.log('\n🎉 Duplicate exam created successfully!');
    console.log(`📊 Summary:`);
    console.log(`  • Original Exam ID: ${originalExamId}`);
    console.log(`  • Duplicate Exam ID: ${newExamId}`);
    console.log(`  • Title: "${duplicateExam.title}"`);
    console.log(`  • Questions: ${insertedQuestions.length}`);
    console.log(`  • Status: Inactive (hidden from students)`);
    
    console.log('\n📋 Next steps:');
    console.log(`1. Convert duplicate to HTML: node scripts/convert-exam-to-html.js ${newExamId}`);
    console.log(`2. Compare results in admin interface`);
    console.log(`3. Clean up when done: DELETE FROM exams WHERE id = '${newExamId}';`);

    return newExamId;

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  duplicateExamForComparison();
}

module.exports = { duplicateExamForComparison };