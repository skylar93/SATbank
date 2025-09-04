/**
 * 완전한 Bluebook SAT 문제 → Supabase 임포터
 * 
 * 기능:
 * 1. 전체 JSON 파일 처리 (모든 테스트, 모든 문제)
 * 2. HTML 이미지/테이블 순서 보존
 * 3. 배치 삽입으로 효율적 처리
 * 4. 상세한 오류 로깅
 * 
 * 사용법:
 * node complete-bluebook-importer.js --test="august_2023" --limit=5 --dry-run
 * node complete-bluebook-importer.js --test="august_2023" --limit=5 --confirm
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

// Module type mapping
function mapModuleType(testId) {
  const mapping = {
    'module_1_august_2023': 'english1',
    'module_1_december_2023': 'english1', 
    'module_1_june_2023': 'english1',
    'module_1_march_2023': 'english1',
    'module_1_may_2023': 'english1',
    'module_1_november_2023': 'english1',
    'module_1_october_2023': 'english1',
    'module_2_august_2023': 'english2',
    'module_2_december_2023': 'english2',
  };
  
  // 기본 패턴 매칭
  if (testId.includes('module_1') && !testId.includes('math')) return 'english1';
  if (testId.includes('module_2') && !testId.includes('math')) return 'english2';
  if (testId.includes('math_module_1')) return 'math1';
  if (testId.includes('math_module_2')) return 'math2';
  
  return mapping[testId] || 'english1';
}

// Convert choices array to options object
function convertChoicesToOptions(choices) {
  if (!choices || !Array.isArray(choices)) return {};
  
  const options = {};
  choices.forEach(choice => {
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      options[letter] = text.trim();
    }
  });
  return options;
}

// Extract correct answer letter from choices
function extractCorrectAnswerLetter(correctAnswer, choices) {
  if (!correctAnswer || !choices) return 'A';
  
  for (const choice of choices) {
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      if (text.trim() === correctAnswer.trim()) {
        return letter;
      }
    }
  }
  
  // Fallback: partial match
  for (const choice of choices) {
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      if (correctAnswer.includes(text.trim()) || text.trim().includes(correctAnswer)) {
        return letter;
      }
    }
  }
  
  console.warn(`⚠️ Could not match correct answer: "${correctAnswer}"`);
  return 'A';
}

// Extract main image URL (first URL, not base64)
function extractMainImageUrl(imageUrls) {
  if (!imageUrls || !Array.isArray(imageUrls)) return null;
  
  const urlImage = imageUrls.find(url => 
    typeof url === 'string' && url.startsWith('https://')
  );
  
  return urlImage || null;
}

// Check if question has meaningful images (not just UI icons)
function hasMeaningfulImages(imageUrls) {
  if (!imageUrls || !Array.isArray(imageUrls)) return false;
  
  // Filter out UI icons and other non-content images
  const meaningfulImages = imageUrls.filter(url => {
    if (typeof url !== 'string') return false;
    
    // Only count real URLs, not base64 UI icons
    if (url.startsWith('https://')) return true;
    
    // If it's a base64 image, check if it's likely content vs UI
    if (url.startsWith('data:image/')) {
      // Very small base64 images are likely UI icons
      // Rough estimate: base64 strings under 2000 chars are likely icons
      return url.length > 5000; // Adjust threshold as needed
    }
    
    return false;
  });
  
  return meaningfulImages.length > 0;
}

// Extract main content from HTML while preserving exact structure and image positioning
function extractMainContentFromHtml(questionHTML) {
  if (!questionHTML || typeof questionHTML !== 'string') {
    return '';
  }
  
  // Clean the HTML while preserving all meaningful content and structure
  let content = questionHTML;
  
  // Remove document structure elements but keep everything else
  content = content.replace(/<\/?html[^>]*>/gi, '');
  content = content.replace(/<\/?head[^>]*>/gi, '');
  content = content.replace(/<\/?body[^>]*>/gi, '');
  content = content.replace(/<\/?DOCTYPE[^>]*>/gi, '');
  content = content.replace(/<meta[^>]*>/gi, '');
  content = content.replace(/<title[^>]*>.*?<\/title>/gi, '');
  
  // Remove script and style tags completely (but keep their content if it's meaningful)
  content = content.replace(/<script[^>]*>.*?<\/script>/gis, '');
  content = content.replace(/<style[^>]*>.*?<\/style>/gis, '');
  
  // FIRST: Cut off everything from the first option-wrapper BEFORE removing div tags
  // This is the most reliable method - works for ALL question formats
  const optionWrapperIndex = content.indexOf('<div class="option-wrapper');
  if (optionWrapperIndex !== -1) {
    content = content.substring(0, optionWrapperIndex).trim();
  } else {
    // Check for other patterns that indicate answer choices start
    const choiceStartPatterns = [
      '<div class=\'option-wrapper\'',
      'Select your answer',
      'select your answer',
      '</div><div><div><div class="option-wrapper',
      '</div></div><div><div><div class="option-wrapper'
    ];
    
    for (const pattern of choiceStartPatterns) {
      const index = content.toLowerCase().indexOf(pattern.toLowerCase());
      if (index !== -1) {
        content = content.substring(0, index).trim();
        break;
      }
    }
  }
  
  // THEN: Remove UI-specific wrapper divs but preserve content structure
  // Target the specific wrapper classes from Bluebook that don't contain meaningful content
  content = content.replace(/<div class="article-cell"[^>]*>/gi, '');
  content = content.replace(/<div class="article-main[^"]*"[^>]*>/gi, '');
  content = content.replace(/<div class="question-cell"[^>]*>/gi, '');
  content = content.replace(/<div class="question-widget"[^>]*>/gi, '');
  content = content.replace(/<div class="question-left"[^>]*>/gi, '');
  content = content.replace(/<div class="question-number-quiz"[^>]*>.*?<\/div>/gis, '');
  content = content.replace(/<div class="review-container"[^>]*>.*?<\/div>/gis, '');
  content = content.replace(/<div class="question-tools"[^>]*>.*?<\/div>/gis, '');
  content = content.replace(/<div class="colorline-container"[^>]*>.*?<\/div>/gis, '');
  content = content.replace(/<div class="question-title[^"]*"[^>]*>/gi, '');
  content = content.replace(/<div class="option-wrapper[^"]*"[^>]*>/gi, '');
  content = content.replace(/<div class="options-cell[^"]*"[^>]*>/gi, '');
  content = content.replace(/<div class="letters-container"[^>]*>.*?<\/div>/gis, '');
  
  // Remove any remaining choice patterns at the end
  // Remove patterns like "A.\nText\nB.\nText\nC.\nText\nD.\nText" that appear after question content
  content = content.replace(/\n\s*A\.\s*\n[^]*?D\.\s*\n[^]*?$/gi, '');
  
  // Remove standalone choice patterns (A. B. C. D.) - more comprehensive
  content = content.replace(/\n\s*[A-D][\.\)]\s*[^\n]*$/gim, '');
  
  // Remove any remaining answer choice blocks at the end
  content = content.replace(/(\n\s*[A-D][\.\)][\s\S]*?[A-D][\.\)][\s\S]*?)$/gi, '');
  
  // Remove extra closing div tags that were left behind
  content = content.replace(/<\/div>\s*<\/div>\s*<\/div>/gi, '');
  content = content.replace(/<\/div>\s*<\/div>/gi, '');
  
  // Clean up excessive whitespace but preserve intentional spacing
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 consecutive newlines
  content = content.replace(/^\s+|\s+$/g, ''); // Trim start/end
  
  // If content is still wrapped in a single div, unwrap it
  const singleDivMatch = content.match(/^<div[^>]*>(.*)<\/div>$/s);
  if (singleDivMatch) {
    content = singleDivMatch[1].trim();
  }
  
  return content || questionHTML; // Return original if cleaning failed
}

// Preserve HTML format with enhanced images
function preserveHtmlFormat(questionHTML, questionText, imageUrls) {
  // If we have questionHTML, extract only the main content
  if (questionHTML) {
    return extractMainContentFromHtml(questionHTML);
  }
  
  // If no HTML but we have questionText, wrap it in basic HTML
  if (questionText) {
    let html = `<div>${questionText}</div>`;
    
    // Add main image if available
    const mainImageUrl = extractMainImageUrl(imageUrls);
    if (mainImageUrl) {
      // Determine image type for alt text
      let altText = 'Data Chart';
      if (mainImageUrl.includes('table')) {
        altText = 'Economic Data Table';
      } else if (mainImageUrl.includes('graph')) {
        altText = 'Data Graph';  
      }
      
      html = `<div><img src="${mainImageUrl}" alt="${altText}" /></div>${html}`;
    }
    
    return html;
  }
  
  return '';
}

// Check if HTML content already contains choice options (A), B), C), D))
function htmlContainsChoices(htmlContent) {
  if (!htmlContent) return false;
  
  // Look for option-wrapper divs (specific to Bluebook HTML structure)
  if (htmlContent.includes('option-wrapper') && htmlContent.includes('option-letter')) {
    return true;
  }
  
  // Fallback: Look for multiple choice patterns like A. B. C. D. in sequence
  const choicePattern = /A\.\s.*?B\.\s.*?C\.\s.*?D\.\s/s;
  return choicePattern.test(htmlContent);
}

// Process a single question
function processQuestion(question, testId, examId) {
  try {
    const moduleType = mapModuleType(testId);
    const options = convertChoicesToOptions(question.choices);
    const correctAnswerLetter = extractCorrectAnswerLetter(question.correctAnswer, question.choices);
    const mainImageUrl = extractMainImageUrl(question.imageUrls);
    
    // Preserve HTML format
    const questionHtmlContent = preserveHtmlFormat(
      question.questionHTML, 
      question.questionText,
      question.imageUrls
    );
    
    // Check if HTML already contains choices to avoid duplication
    const hasHtmlChoices = htmlContainsChoices(questionHtmlContent);
    const shouldStoreOptions = !hasHtmlChoices && Object.keys(options).length > 0;
    
    // If HTML content exists and has meaningful content, use HTML format
    const isHtmlFormat = questionHtmlContent && questionHtmlContent.length > 50;
    
    return {
      exam_id: examId,
      question_number: question.questionNumber,
      module_type: moduleType,
      question_type: question.questionType === 'grid_in' ? 'grid_in' : 'multiple_choice',
      question_html: isHtmlFormat ? questionHtmlContent : null,
      question_text: question.questionText || '', // Keep original text as fallback
      options: shouldStoreOptions ? options : null,
      correct_answer: [correctAnswerLetter],
      explanation: question.explanation || null,
      difficulty_level: 'medium',
      topic_tags: [getTopicFromModuleType(moduleType)],
      question_image_url: isHtmlFormat ? null : mainImageUrl, // Don't duplicate image if already in HTML
      content_format: isHtmlFormat ? 'html' : 'markdown'
    };
  } catch (error) {
    console.error(`❌ Error processing question ${question.questionNumber}:`, error);
    return null;
  }
}

function getTopicFromModuleType(moduleType) {
  const topics = {
    'english1': 'reading_comprehension',
    'english2': 'writing_language',
    'math1': 'algebra_problem_solving',
    'math2': 'advanced_math'
  };
  return topics[moduleType] || 'general';
}

// Create or get exam
async function createOrGetExam(testId, testName, totalQuestions) {
  const examTitle = `${testName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} (Auto Import)`;
  
  // Check if exam exists
  let { data: existingExam, error: examError } = await supabase
    .from('exams')
    .select('id, title')
    .eq('title', examTitle)
    .single();
    
  if (examError && examError.code === 'PGRST116') {
    // Create new exam
    const moduleType = mapModuleType(testId);
    const timeLimit = moduleType.includes('english') ? 64 : 70; // English: 64min, Math: 70min
    
    const { data: newExam, error: createError } = await supabase
      .from('exams')
      .insert([{
        title: examTitle,
        description: `Auto-imported from ${testId}`,
        time_limits: {
          [moduleType]: timeLimit,
          english1: moduleType === 'english1' ? timeLimit : 0,
          english2: moduleType === 'english2' ? timeLimit : 0,
          math1: moduleType === 'math1' ? timeLimit : 0,
          math2: moduleType === 'math2' ? timeLimit : 0
        },
        total_questions: totalQuestions,
        is_active: true,
        is_mock_exam: false,
        is_custom_assignment: true,
        answer_check_mode: 'exam_end'
      }])
      .select()
      .single();
      
    if (createError) {
      throw new Error(`Failed to create exam: ${createError.message}`);
    }
    
    console.log(`✅ Created new exam: "${examTitle}" (${newExam.id})`);
    return newExam.id;
  } else if (examError) {
    throw new Error(`Failed to check exam: ${examError.message}`);
  } else {
    console.log(`♻️ Using existing exam: "${examTitle}" (${existingExam.id})`);
    return existingExam.id;
  }
}

// Batch insert questions
async function insertQuestions(questions, batchSize = 10) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    
    try {
      const { data, error } = await supabase
        .from('questions')
        .upsert(batch, {
          onConflict: 'exam_id,question_number,module_type'
        })
        .select('id, question_number, question_image_url');
        
      if (error) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} failed:`, error.message);
        results.failed += batch.length;
        results.errors.push({
          batch: Math.floor(i/batchSize) + 1,
          error: error.message,
          questions: batch.map(q => q.question_number)
        });
      } else {
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1}: Inserted ${data.length} questions`);
        results.success += data.length;
        
        // Log questions with images
        data.forEach(q => {
          if (q.question_image_url) {
            console.log(`   📷 Q${q.question_number}: ${q.question_image_url}`);
          }
        });
      }
    } catch (err) {
      console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} exception:`, err.message);
      results.failed += batch.length;
      results.errors.push({
        batch: Math.floor(i/batchSize) + 1,
        error: err.message,
        questions: batch.map(q => q.question_number)
      });
    }
    
    // Small delay between batches
    if (i + batchSize < questions.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

// Main processing function
async function processTestData(testFilter = null, questionLimit = null, dryRun = true) {
  try {
    console.log('🚀 Starting Bluebook SAT Import Process...\n');
    
    // Load data
    const dataPath = path.join(__dirname, 'bluebook-sat-problems-2025-09-01.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    console.log(`📊 Loaded data with ${data.tests.length} tests`);
    
    // Filter tests if specified
    let testsToProcess = data.tests;
    if (testFilter) {
      testsToProcess = data.tests.filter(test => 
        test.testId.toLowerCase().includes(testFilter.toLowerCase())
      );
      console.log(`🔍 Filtered to ${testsToProcess.length} tests matching "${testFilter}"`);
    }
    
    if (testsToProcess.length === 0) {
      console.log('❌ No tests found to process');
      return;
    }
    
    const totalResults = {
      testsProcessed: 0,
      questionsProcessed: 0,
      questionsSucceeded: 0,
      questionsFailed: 0,
      errors: []
    };
    
    // Process each test
    for (const test of testsToProcess) {
      console.log(`\n📝 Processing: ${test.testId}`);
      console.log(`   Questions: ${test.questions.length}`);
      console.log(`   Module: ${mapModuleType(test.testId)}`);
      
      // Limit questions if specified
      let questionsToProcess = test.questions;
      if (questionLimit && questionsToProcess.length > questionLimit) {
        questionsToProcess = questionsToProcess.slice(0, questionLimit);
        console.log(`   📊 Limited to first ${questionLimit} questions`);
      }
      
      if (dryRun) {
        console.log('   🔍 DRY RUN - Processing sample questions...\n');
        
        // Process all questions for preview (up to limit)
        const sampleQuestions = questionsToProcess;
        sampleQuestions.forEach((question, index) => {
          console.log(`   Question ${question.questionNumber}:`);
          console.log(`      Original choices: ${question.choices?.length || 0}`);
          console.log(`      Original correct: "${question.correctAnswer?.slice(0, 50)}..."`);
          console.log(`      Has meaningful images: ${hasMeaningfulImages(question.imageUrls) ? '✅' : '❌'}`);
          console.log(`      Total imageUrls: ${question.imageUrls?.length || 0}`);
          
          const processed = processQuestion(question, test.testId, 'dummy-exam-id');
          if (processed) {
            console.log(`      → Module: ${processed.module_type}`);
            console.log(`      → Options: ${JSON.stringify(processed.options)}`);
            console.log(`      → Correct: ${processed.correct_answer}`);
            console.log(`      → Image URL: ${processed.question_image_url ? '✅' : '❌'}`);
            console.log(`      → HTML content length: ${processed.question_html.length} chars`);
            console.log(`      → Plain text length: ${processed.question_text.length} chars`);
            
            // Show HTML preview
            const htmlPreview = processed.question_html.slice(0, 200).replace(/\n/g, ' ');
            console.log(`      → HTML preview: "${htmlPreview}..."`);
          }
          console.log('');
        });
        
      } else {
        console.log('   💾 LIVE MODE - Inserting to database...\n');
        
        // Create exam
        const examId = await createOrGetExam(test.testId, test.testName, questionsToProcess.length);
        
        // Process questions
        const processedQuestions = [];
        for (const question of questionsToProcess) {
          const processed = processQuestion(question, test.testId, examId);
          if (processed) {
            processedQuestions.push(processed);
          }
        }
        
        console.log(`   📦 Processed ${processedQuestions.length}/${questionsToProcess.length} questions`);
        
        // Insert questions
        if (processedQuestions.length > 0) {
          const results = await insertQuestions(processedQuestions);
          console.log(`   ✅ Success: ${results.success}, Failed: ${results.failed}`);
          
          totalResults.questionsSucceeded += results.success;
          totalResults.questionsFailed += results.failed;
          totalResults.errors.push(...results.errors);
        }
      }
      
      totalResults.testsProcessed++;
      totalResults.questionsProcessed += questionsToProcess.length;
    }
    
    // Final summary
    console.log('\n🎉 Import Process Complete!');
    console.log('='.repeat(50));
    console.log(`Tests processed: ${totalResults.testsProcessed}`);
    console.log(`Questions processed: ${totalResults.questionsProcessed}`);
    
    if (!dryRun) {
      console.log(`Questions succeeded: ${totalResults.questionsSucceeded}`);
      console.log(`Questions failed: ${totalResults.questionsFailed}`);
      console.log(`Success rate: ${(totalResults.questionsSucceeded/totalResults.questionsProcessed*100).toFixed(1)}%`);
      
      if (totalResults.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        totalResults.errors.forEach(error => {
          console.log(`   Batch ${error.batch}: ${error.error}`);
          console.log(`   Questions: ${error.questions.join(', ')}`);
        });
      }
    }
    
    // Save results to file
    const resultsPath = path.join(__dirname, `import-results-${Date.now()}.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(totalResults, null, 2));
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
    testFilter: null,
    questionLimit: null,
    dryRun: true
  };
  
  args.forEach(arg => {
    if (arg.startsWith('--test=')) {
      config.testFilter = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      config.questionLimit = parseInt(arg.split('=')[1]);
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
    
    console.log('⚙️ Configuration:');
    console.log(`   Test filter: ${config.testFilter || 'all'}`);
    console.log(`   Question limit: ${config.questionLimit || 'no limit'}`);
    console.log(`   Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE IMPORT'}`);
    console.log('');
    
    if (config.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be inserted');
      console.log('   Add --confirm flag to perform actual import');
      console.log('');
    }
    
    await processTestData(config.testFilter, config.questionLimit, config.dryRun);
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Help message
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Complete Bluebook SAT Importer

Usage:
  node complete-bluebook-importer.js [options]

Options:
  --test=<filter>    Filter tests by name (e.g., "august_2023")
  --limit=<number>   Limit number of questions per test  
  --dry-run          Preview mode (default)
  --confirm          Actually perform import
  --help, -h         Show this help

Examples:
  # Preview August 2023 tests, first 5 questions only
  node complete-bluebook-importer.js --test="august_2023" --limit=5 --dry-run
  
  # Actually import August 2023 Module 1, first 5 questions
  node complete-bluebook-importer.js --test="august_2023" --limit=5 --confirm
  
  # Preview all tests
  node complete-bluebook-importer.js --dry-run
`);
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  processTestData,
  mapModuleType,
  convertChoicesToOptions,
  extractCorrectAnswerLetter,
  extractMainContentFromHtml
};