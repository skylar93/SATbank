/**
 * Fix existing questions in database with broken HTML tags
 * This script repairs already imported questions that have corrupted HTML
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Environment setup
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

const supabase = createClient(supabaseUrl, supabaseKey);

// Fix broken HTML tags function (copied from importer)
function fixBrokenHtmlTags(content) {
  if (!content || typeof content !== 'string') return content;

  let repaired = content;
  let repairCount = 0;

  // Fix broken <strong> tags (most common issue)
  const brokenStrongOpen = /<\s*s\s*t\s*r\s*o\s*n\s*g\s*>/gi;
  const brokenStrongClose = /<\s*\/\s*s\s*t\s*r\s*o\s*n\s*g\s*>/gi;

  if (brokenStrongOpen.test(content) || brokenStrongClose.test(content)) {
    repaired = repaired
      .replace(brokenStrongOpen, '<strong>')
      .replace(brokenStrongClose, '</strong>');
    repairCount++;
  }

  // Fix broken <em> tags
  const brokenEmOpen = /<\s*e\s*m\s*>/gi;
  const brokenEmClose = /<\s*\/\s*e\s*m\s*>/gi;

  if (brokenEmOpen.test(content) || brokenEmClose.test(content)) {
    repaired = repaired
      .replace(brokenEmOpen, '<em>')
      .replace(brokenEmClose, '</em>');
    repairCount++;
  }

  // Fix broken <span> tags
  const brokenSpanOpen = /<\s*s\s*p\s*a\s*n([^>]*)>/gi;
  const brokenSpanClose = /<\s*\/\s*s\s*p\s*a\s*n\s*>/gi;

  if (brokenSpanOpen.test(content) || brokenSpanClose.test(content)) {
    repaired = repaired
      .replace(brokenSpanOpen, '<span$1>')
      .replace(brokenSpanClose, '</span>');
    repairCount++;
  }

  // Fix broken <div> tags
  const brokenDivOpen = /<\s*d\s*i\s*v([^>]*)>/gi;
  const brokenDivClose = /<\s*\/\s*d\s*i\s*v\s*>/gi;

  if (brokenDivOpen.test(content) || brokenDivClose.test(content)) {
    repaired = repaired
      .replace(brokenDivOpen, '<div$1>')
      .replace(brokenDivClose, '</div>');
    repairCount++;
  }

  // Fix broken <p> tags
  const brokenPOpen = /<\s*p\s*([^>]*)>/gi;
  const brokenPClose = /<\s*\/\s*p\s*>/gi;

  if (brokenPOpen.test(content) || brokenPClose.test(content)) {
    repaired = repaired
      .replace(brokenPOpen, '<p$1>')
      .replace(brokenPClose, '</p>');
    repairCount++;
  }

  // Fix any remaining broken angle brackets and invisible characters
  repaired = repaired
    .replace(/< \s*/g, '<')  // Fix "< strong>" → "<strong>"
    .replace(/\s* >/g, '>')  // Fix "strong >" → "strong>"
    .replace(/<\s+/g, '<')   // Fix "<  strong>" → "<strong>"
    .replace(/\s+>/g, '>')   // Fix "strong  >" → "strong>"
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/​/g, '');      // Remove specific invisible character found in data

  return { repaired, repairCount };
}

// Detect if content has broken HTML tags
function hasBrokenHtmlTags(content) {
  if (!content || typeof content !== 'string') return false;

  const brokenPatterns = [
    /<\s*s\s*t\s*r\s*o\s*n\s*g\s*>/i,
    /<\s*\/\s*s\s*t\s*r\s*o\s*n\s*g\s*>/i,
    /<\s*e\s*m\s*>/i,
    /<\s*\/\s*e\s*m\s*>/i,
    /<\s*s\s*p\s*a\s*n/i,
    /<\s*\/\s*s\s*p\s*a\s*n\s*>/i,
    /<\s*d\s*i\s*v/i,
    /<\s*\/\s*d\s*i\s*v\s*>/i,
    /<\s*p\s*>/i,
    /<\s*\/\s*p\s*>/i
  ];

  return brokenPatterns.some(pattern => pattern.test(content));
}

// Main repair function
async function repairExistingQuestions(dryRun = true, examFilter = null) {
  try {
    console.log('🔧 Starting repair of existing questions with broken HTML tags...\n');

    // Get all questions that might need repair
    let query = supabase
      .from('questions')
      .select('id, exam_id, question_number, question_html, options, content_format');

    if (examFilter) {
      // Get exam ID if filter is provided
      const { data: examData } = await supabase
        .from('exams')
        .select('id')
        .ilike('title', `%${examFilter}%`);

      if (examData && examData.length > 0) {
        query = query.in('exam_id', examData.map(e => e.id));
        console.log(`🔍 Filtering to exams matching "${examFilter}"`);
      }
    }

    const { data: questions, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch questions: ${error.message}`);
    }

    console.log(`📊 Found ${questions.length} total questions to check`);

    const questionsToRepair = [];
    const repairStats = {
      checked: 0,
      needsRepair: 0,
      repaired: 0,
      failed: 0
    };

    // Check which questions need repair
    for (const question of questions) {
      repairStats.checked++;

      let needsRepair = false;
      const updates = { id: question.id };

      // Check question_html
      if (question.question_html && hasBrokenHtmlTags(question.question_html)) {
        const { repaired, repairCount } = fixBrokenHtmlTags(question.question_html);
        if (repairCount > 0) {
          updates.question_html = repaired;
          needsRepair = true;
          console.log(`   Q${question.question_number}: Found ${repairCount} broken HTML patterns in question_html`);
        }
      }

      // Check options (for multiple choice questions)
      if (question.options && typeof question.options === 'object') {
        const repairedOptions = {};
        let optionsChanged = false;

        for (const [key, value] of Object.entries(question.options)) {
          if (typeof value === 'string' && hasBrokenHtmlTags(value)) {
            const { repaired, repairCount } = fixBrokenHtmlTags(value);
            if (repairCount > 0) {
              repairedOptions[key] = repaired;
              optionsChanged = true;
              console.log(`   Q${question.question_number}: Fixed option ${key} with ${repairCount} patterns`);
            } else {
              repairedOptions[key] = value;
            }
          } else {
            repairedOptions[key] = value;
          }
        }

        if (optionsChanged) {
          updates.options = repairedOptions;
          needsRepair = true;
        }
      }

      if (needsRepair) {
        questionsToRepair.push(updates);
        repairStats.needsRepair++;
      }
    }

    console.log(`\n📋 Repair Summary:`);
    console.log(`   Total checked: ${repairStats.checked}`);
    console.log(`   Need repair: ${repairStats.needsRepair}`);

    if (questionsToRepair.length === 0) {
      console.log('✅ No questions need repair!');
      return;
    }

    if (dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made');
      console.log('   Add --confirm flag to apply repairs');

      // Show first few examples
      const examples = questionsToRepair.slice(0, 3);
      console.log('\n📝 Example repairs:');
      for (const ex of examples) {
        console.log(`   Question ID: ${ex.id}`);
        if (ex.question_html) console.log(`     HTML: ${ex.question_html.slice(0, 100)}...`);
        if (ex.options) console.log(`     Options: ${JSON.stringify(ex.options)}`);
      }
    } else {
      console.log(`\n💾 LIVE MODE - Updating ${questionsToRepair.length} questions...`);

      // Update in batches
      const batchSize = 10;
      for (let i = 0; i < questionsToRepair.length; i += batchSize) {
        const batch = questionsToRepair.slice(i, i + batchSize);

        try {
          const { data, error } = await supabase
            .from('questions')
            .upsert(batch, { onConflict: 'id' })
            .select('id, question_number');

          if (error) {
            console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
            repairStats.failed += batch.length;
          } else {
            console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: Updated ${data.length} questions`);
            repairStats.repaired += data.length;
          }
        } catch (err) {
          console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} exception:`, err.message);
          repairStats.failed += batch.length;
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log('\n🎉 Repair Complete!');
      console.log(`   Successfully repaired: ${repairStats.repaired}`);
      console.log(`   Failed: ${repairStats.failed}`);
      console.log(`   Success rate: ${(repairStats.repaired/repairStats.needsRepair*100).toFixed(1)}%`);
    }

    // Save results
    const resultsPath = path.join(__dirname, `repair-results-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify({
      ...repairStats,
      questionsToRepair: questionsToRepair.map(q => ({ id: q.id, hasHtml: !!q.question_html, hasOptions: !!q.options }))
    }, null, 2));
    console.log(`\n📄 Results saved to: ${resultsPath}`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    examFilter: null,
    dryRun: true
  };

  args.forEach(arg => {
    if (arg.startsWith('--exam=')) {
      config.examFilter = arg.split('=')[1];
    } else if (arg === '--confirm') {
      config.dryRun = false;
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    }
  });

  return config;
}

// Main execution
async function main() {
  try {
    const config = parseArgs();

    console.log('⚙️ HTML Tag Repair Configuration:');
    console.log(`   Exam filter: ${config.examFilter || 'all exams'}`);
    console.log(`   Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE REPAIR'}`);
    console.log('');

    await repairExistingQuestions(config.dryRun, config.examFilter);

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Help message
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
HTML Tag Repair Script

Fixes broken HTML tags in existing database questions.

Usage:
  node fix-existing-questions.js [options]

Options:
  --exam=<filter>    Filter to specific exam (partial title match)
  --dry-run          Preview mode (default)
  --confirm          Actually perform repairs
  --help, -h         Show this help

Examples:
  # Preview repairs for all questions
  node fix-existing-questions.js --dry-run

  # Repair specific exam
  node fix-existing-questions.js --exam="March 2025" --confirm

  # Repair all questions
  node fix-existing-questions.js --confirm
`);
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  repairExistingQuestions,
  fixBrokenHtmlTags,
  hasBrokenHtmlTags
};