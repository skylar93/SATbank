#!/usr/bin/env node

/**
 * Restore Exam from Backup Script
 * Restores a specific exam from markdown backup columns
 * 
 * Usage: node scripts/restore-exam-from-backup.js <exam_id>
 * Example: node scripts/restore-exam-from-backup.js 6f4eb255-3d1a-4e4c-90f3-99364b63c91a
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

async function restoreExamFromBackup() {
  const examId = process.argv[2];
  if (!examId) {
    console.error('❌ Please provide an exam_id to restore.');
    console.error('Usage: node scripts/restore-exam-from-backup.js <exam_id>');
    process.exit(1);
  }

  console.log(`🔄 Restoring exam from backup: ${examId}`);

  try {
    // Get exam info
    const { data: examInfo } = await supabase
      .from('exams')
      .select('title')
      .eq('id', examId)
      .single();

    if (!examInfo) {
      console.error(`❌ Exam with ID ${examId} not found`);
      process.exit(1);
    }

    console.log(`📚 Restoring exam: "${examInfo.title}"`);

    // First, get all questions with their backup data
    const { data: questions, error: fetchError } = await supabase
      .from('questions')
      .select('id, question_markdown_backup, options_markdown_backup, explanation_markdown_backup')
      .eq('exam_id', examId);

    if (fetchError) {
      console.error('❌ Failed to fetch questions:', fetchError.message);
      process.exit(1);
    }

    console.log(`🔄 Restoring ${questions.length} questions...`);

    // Restore each question individually
    let restoredCount = 0;
    for (const question of questions) {
      const { error: updateError } = await supabase
        .from('questions')
        .update({
          question_text: question.question_markdown_backup,
          options: question.options_markdown_backup,
          explanation: question.explanation_markdown_backup,
          question_html: null,
          options_html: null,
          explanation_html: null,
          html_migration_status: 'pending'
        })
        .eq('id', question.id);

      if (updateError) {
        console.error(`❌ Failed to restore question ${question.id}:`, updateError.message);
      } else {
        restoredCount++;
      }
    }

    console.log(`✅ Successfully restored ${restoredCount} questions from backup`);
    console.log('🎉 Exam has been completely restored to original markdown format');

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  restoreExamFromBackup();
}