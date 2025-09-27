/**
 * 수학 문제용 개선된 Bluebook SAT 임포터
 *
 * 개선사항:
 * 1. Grid-in 문제를 위한 correct_answers 배열 처리
 * 2. LaTeX 수식 추출 및 변환
 * 3. 수학 기호 정답 매칭 개선
 * 4. 여러 형태 정답 허용 (분수, 소수, 루트 등)
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

// Module type mapping for math
function mapModuleType(testId) {
  // Math module mapping
  if (testId.includes('math_module_1') || testId.includes('math1')) return 'math1';
  if (testId.includes('math_module_2') || testId.includes('math2')) return 'math2';

  // Default fallback
  if (testId.includes('module_1')) return 'math1';
  if (testId.includes('module_2')) return 'math2';

  return 'math1';
}

// FUNDAMENTAL SOLUTION: Convert ALL math to clean LaTeX-only format
function extractLatexFromHtml(htmlContent) {
  if (!htmlContent) return htmlContent;

  let processed = htmlContent;
  console.log('   📊 Converting all math content to clean LaTeX format...');

  // Step 1: Remove existing $ delimiters temporarily to avoid conflicts
  const preservedMath = [];
  let mathIndex = 0;

  // Preserve display math ($$...$$)
  processed = processed.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
    const placeholder = `__PRESERVED_DISPLAY_${mathIndex}__`;
    preservedMath.push({ placeholder, latex: content.trim(), isDisplay: true });
    mathIndex++;
    return placeholder;
  });

  // Preserve inline math ($...$)
  processed = processed.replace(/\$([^$]+)\$/g, (match, content) => {
    const placeholder = `__PRESERVED_INLINE_${mathIndex}__`;
    preservedMath.push({ placeholder, latex: content.trim(), isDisplay: false });
    mathIndex++;
    return placeholder;
  });

  // Improved: Use balanced bracket matching to completely remove mathquill structures
  function findCompleteSpan(text, startIndex) {
    let depth = 0;
    let i = startIndex;

    while (i < text.length) {
      if (text.substring(i, i + 5) === '<span') {
        depth++;
        i += 5;
      } else if (text.substring(i, i + 7) === '</span>') {
        depth--;
        i += 7;
        if (depth === 0) {
          return i;
        }
      } else {
        i++;
      }
    }
    return -1;
  }

  // Step 2: Extract MathQuill LaTeX data and convert to clean format
  const latexRegex = /latex-data="([^"]*)"/g;
  let match;
  const extractedMathQuill = [];

  while ((match = latexRegex.exec(processed)) !== null) {
    extractedMathQuill.push({
      latex: match[1],
      index: match.index
    });
  }

  // Process MathQuill spans in reverse order to maintain indices
  for (let i = extractedMathQuill.length - 1; i >= 0; i--) {
    const data = extractedMathQuill[i];

    // Find the complete MathQuill span
    let spanStart = processed.lastIndexOf('<span', data.index);
    if (spanStart === -1) continue;

    let spanOpenEnd = processed.indexOf('>', spanStart);
    let spanTag = processed.substring(spanStart, spanOpenEnd + 1);

    if (!spanTag.includes('mq-math-mode')) continue;

    let spanEnd = findCompleteSpan(processed, spanStart);
    if (spanEnd === -1) continue;

    // Clean LaTeX content
    let latex = data.latex
      .replace(/\\cdot/g, '\\cdot')
      .replace(/\\times/g, '\\times')
      .replace(/\\div/g, '\\div')
      .replace(/\\pm/g, '\\pm')
      .replace(/\\sqrt{([^}]*)}/g, '\\sqrt{$1}')
      .replace(/\\frac{([^}]*)}{([^}]*)}/g, '\\frac{$1}{$2}')
      .trim();

    // Replace with placeholder for now
    let beforeSpan = processed.substring(0, spanStart);
    let afterSpan = processed.substring(spanEnd);

    const placeholder = `__EXTRACTED_MATHQUILL_${mathIndex}__`;
    preservedMath.push({ placeholder, latex, isDisplay: true }); // MathQuill usually display mode
    mathIndex++;

    processed = beforeSpan + placeholder + afterSpan;
    console.log(`   🔄 Extracted MathQuill LaTeX: ${latex}`);
  }

  // Step 3: Restore all math as consistent LaTeX format
  preservedMath.forEach(math => {
    const delimiter = math.isDisplay ? '$$' : '$';
    const replacement = `${delimiter}${math.latex}${delimiter}`;
    processed = processed.replace(math.placeholder, replacement);
    console.log(`   ✅ Restored as ${math.isDisplay ? 'display' : 'inline'} LaTeX: ${replacement}`);
  });

  return processed;
}

// Normalize math expressions for better matching
function normalizeMathExpression(expr) {
  if (!expr || typeof expr !== 'string') return '';

  return expr
    .replace(/\s+/g, '') // Remove spaces
    .replace(/\$+/g, '') // Remove $ symbols
    .replace(/√/g, 'sqrt') // Convert root symbol
    .replace(/×/g, '*') // Convert multiplication
    .replace(/÷/g, '/') // Convert division
    .replace(/·/g, '*') // Convert dot multiplication
    .toLowerCase();
}

// Fix broken HTML tags that got corrupted during parsing
function fixBrokenHtmlTags(content) {
  if (!content || typeof content !== 'string') return content;

  console.log('   🔧 Repairing broken HTML tags...');

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
    console.log('      ✅ Fixed broken <strong> tags');
  }

  // Fix broken <em> tags
  const brokenEmOpen = /<\s*e\s*m\s*>/gi;
  const brokenEmClose = /<\s*\/\s*e\s*m\s*>/gi;

  if (brokenEmOpen.test(content) || brokenEmClose.test(content)) {
    repaired = repaired
      .replace(brokenEmOpen, '<em>')
      .replace(brokenEmClose, '</em>');
    repairCount++;
    console.log('      ✅ Fixed broken <em> tags');
  }

  // Fix broken <span> tags
  const brokenSpanOpen = /<\s*s\s*p\s*a\s*n([^>]*)>/gi;
  const brokenSpanClose = /<\s*\/\s*s\s*p\s*a\s*n\s*>/gi;

  if (brokenSpanOpen.test(content) || brokenSpanClose.test(content)) {
    repaired = repaired
      .replace(brokenSpanOpen, '<span$1>')
      .replace(brokenSpanClose, '</span>');
    repairCount++;
    console.log('      ✅ Fixed broken <span> tags');
  }

  // Fix broken <div> tags
  const brokenDivOpen = /<\s*d\s*i\s*v([^>]*)>/gi;
  const brokenDivClose = /<\s*\/\s*d\s*i\s*v\s*>/gi;

  if (brokenDivOpen.test(content) || brokenDivClose.test(content)) {
    repaired = repaired
      .replace(brokenDivOpen, '<div$1>')
      .replace(brokenDivClose, '</div>');
    repairCount++;
    console.log('      ✅ Fixed broken <div> tags');
  }

  // Fix broken <p> tags
  const brokenPOpen = /<\s*p\s*([^>]*)>/gi;
  const brokenPClose = /<\s*\/\s*p\s*>/gi;

  if (brokenPOpen.test(content) || brokenPClose.test(content)) {
    repaired = repaired
      .replace(brokenPOpen, '<p$1>')
      .replace(brokenPClose, '</p>');
    repairCount++;
    console.log('      ✅ Fixed broken <p> tags');
  }

  // Fix any remaining broken angle brackets and invisible characters
  repaired = repaired
    .replace(/< \s*/g, '<')  // Fix "< strong>" → "<strong>"
    .replace(/\s* >/g, '>')  // Fix "strong >" → "strong>"
    .replace(/<\s+/g, '<')   // Fix "<  strong>" → "<strong>"
    .replace(/\s+>/g, '>')   // Fix "strong  >" → "strong>"
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/​/g, '');      // Remove specific invisible character found in data

  if (repairCount > 0) {
    console.log(`   ✅ Repaired ${repairCount} types of broken HTML tags`);
  } else {
    console.log('   ℹ️ No broken HTML tags found');
  }

  return repaired;
}

// Clean special characters from answer strings
function cleanAnswerString(answer) {
  if (!answer || typeof answer !== 'string') return answer;

  return answer
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '') // Remove zero-width spaces and non-breaking spaces
    .replace(/[^\x00-\x7F]/g, (char) => {
      // Replace special unicode characters with standard equivalents
      const charCode = char.charCodeAt(0);
      if (charCode === 8722) return '-'; // minus sign → regular dash
      if (charCode === 8730) return '√'; // square root symbol
      if (charCode === 215) return '*';   // multiplication sign
      if (charCode === 247) return '/';   // division sign
      return char; // keep other characters
    })
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

// Generate multiple acceptable answer formats for grid-in questions
function generateAcceptableAnswers(correctAnswer) {
  if (!correctAnswer || typeof correctAnswer !== 'string') return [correctAnswer];

  // Clean the input first
  const cleanAnswer = cleanAnswerString(correctAnswer);
  console.log(`   🧹 Cleaned "${correctAnswer}" → "${cleanAnswer}"`);

  const answers = new Set([cleanAnswer]);
  const normalized = normalizeMathExpression(cleanAnswer);

  // Handle fractions and decimals
  if (cleanAnswer.includes('/')) {
    try {
      const parts = cleanAnswer.split('/');
      if (parts.length === 2) {
        const num = parseFloat(parts[0]);
        const den = parseFloat(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) {
          const decimal = (num / den).toString();
          answers.add(decimal);

          // Add common decimal representations
          if (decimal.includes('.')) {
            const rounded = Math.round(num / den * 100) / 100;
            answers.add(rounded.toString());
          }
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Handle decimal to fraction conversion
  if (cleanAnswer.includes('.')) {
    try {
      const decimal = parseFloat(cleanAnswer);
      if (!isNaN(decimal)) {
        // Convert common decimals to fractions
        if (decimal === 0.5) answers.add('1/2');
        if (decimal === 0.25) answers.add('1/4');
        if (decimal === 0.75) answers.add('3/4');
        if (decimal === 0.33 || decimal === 0.333) answers.add('1/3');
        if (decimal === 0.67 || decimal === 0.667) answers.add('2/3');
        if (decimal === 2.25) answers.add('9/4');
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Handle square roots
  if (cleanAnswer.includes('√')) {
    const withSqrt = cleanAnswer.replace('√', 'sqrt(') + ')';
    answers.add(withSqrt);
    answers.add(cleanAnswer.replace('√', '√'));
  }

  // Handle special cases
  if (cleanAnswer.includes(',')) {
    // Multiple answers format like "2.25,9/4"
    const parts = cleanAnswer.split(',');
    parts.forEach(part => {
      const cleanPart = cleanAnswerString(part.trim());
      answers.add(cleanPart);
      const subAnswers = generateAcceptableAnswers(cleanPart);
      subAnswers.forEach(ans => answers.add(ans));
    });
  }

  // Remove empty strings and return array
  return Array.from(answers).filter(ans => ans && ans.length > 0);
}

// Convert choices array to options object (for multiple choice)
function convertChoicesToOptions(choices) {
  if (!choices || !Array.isArray(choices)) return {};

  const options = {};
  choices.forEach(choice => {
    if (typeof choice === 'object' && choice.letter && choice.text) {
      // Process LaTeX content if present
      const processedText = extractLatexFromHtml(choice.text);
      options[choice.letter] = processedText.trim();
    } else if (typeof choice === 'string') {
      const match = choice.match(/^([A-D])\)\s*(.*)$/);
      if (match) {
        const [, letter, text] = match;
        // Process LaTeX content if present
        const processedText = extractLatexFromHtml(text);
        options[letter] = processedText.trim();
      }
    }
  });
  return options;
}

// Extract correct answer letter for multiple choice
function extractCorrectAnswerLetter(correctAnswer, choices) {
  if (!correctAnswer || !choices) return 'A';

  // Clean the correct answer first
  const cleanCorrectAnswer = cleanAnswerString(correctAnswer);
  const normalizedCorrect = normalizeMathExpression(cleanCorrectAnswer);

  console.log(`   🔍 Finding match for: "${correctAnswer}" (cleaned: "${cleanCorrectAnswer}")`);

  for (const choice of choices) {
    let letter, text;

    if (typeof choice === 'object' && choice.letter && choice.text) {
      letter = choice.letter;
      text = choice.text;
    } else if (typeof choice === 'string') {
      const match = choice.match(/^([A-D])\)\s*(.*)$/);
      if (match) {
        [, letter, text] = match;
      } else {
        continue;
      }
    } else {
      continue;
    }

    // Clean the choice text
    const cleanChoiceText = cleanAnswerString(text);
    console.log(`      Option ${letter}: "${text}" (cleaned: "${cleanChoiceText}")`);

    // Exact match (after cleaning)
    if (cleanChoiceText.trim() === cleanCorrectAnswer.trim()) {
      console.log(`      ✅ Exact match found: ${letter}`);
      return letter;
    }

    // Normalized math expression match
    const normalizedChoice = normalizeMathExpression(text);
    if (normalizedCorrect && normalizedCorrect === normalizedChoice) {
      console.log(`      ✅ Normalized match found: ${letter}`);
      return letter;
    }

    // Handle LaTeX expressions
    if (cleanCorrectAnswer.includes('$') && cleanChoiceText.includes('$')) {
      const correctLatex = cleanCorrectAnswer.replace(/\$/g, '');
      const choiceLatex = cleanChoiceText.replace(/\$/g, '');
      if (correctLatex.trim() === choiceLatex.trim()) {
        console.log(`      ✅ LaTeX match found: ${letter}`);
        return letter;
      }
    }

    // Partial match for complex expressions
    if (cleanCorrectAnswer.length > 10 && (
        cleanChoiceText.includes(cleanCorrectAnswer.slice(0, 10)) ||
        cleanCorrectAnswer.includes(cleanChoiceText.slice(0, 10))
    )) {
      console.log(`      ✅ Partial match found: ${letter}`);
      return letter;
    }

    // Try matching without HTML tags
    const cleanCorrectNoHtml = cleanCorrectAnswer.replace(/<[^>]*>/g, '').trim();
    const cleanChoiceNoHtml = cleanChoiceText.replace(/<[^>]*>/g, '').trim();
    if (cleanCorrectNoHtml && cleanCorrectNoHtml === cleanChoiceNoHtml) {
      console.log(`      ✅ HTML-stripped match found: ${letter}`);
      return letter;
    }
  }

  console.warn(`   ⚠️ Could not match correct answer: "${correctAnswer}" (cleaned: "${cleanCorrectAnswer}")`);
  console.warn(`   Available choices:`, choices.map(c => typeof c === 'object' ? `${c.letter}: ${c.text}` : c));
  return 'A';
}

// Enhanced content extraction with LaTeX processing
function extractMainContentFromHtml(questionHTML) {
  if (!questionHTML || typeof questionHTML !== 'string') {
    return '';
  }

  // Step 1: Fix broken HTML tags FIRST
  let content = fixBrokenHtmlTags(questionHTML);

  // Step 2: Extract and convert LaTeX
  content = extractLatexFromHtml(content);

  // Then apply the existing content extraction logic
  content = content.replace(/<\/?html[^>]*>/gi, '');
  content = content.replace(/<\/?head[^>]*>/gi, '');
  content = content.replace(/<\/?body[^>]*>/gi, '');
  content = content.replace(/<\/?DOCTYPE[^>]*>/gi, '');
  content = content.replace(/<meta[^>]*>/gi, '');
  content = content.replace(/<title[^>]*>.*?<\/title>/gi, '');
  content = content.replace(/<script[^>]*>.*?<\/script>/gis, '');

  // Remove choice sections
  const optionWrapperIndex = content.indexOf('<div class="option-wrapper');
  if (optionWrapperIndex !== -1) {
    content = content.substring(0, optionWrapperIndex).trim();
  }

  // Clean up UI elements
  content = content.replace(/<div class="article-cell"[^>]*>/gi, '');
  content = content.replace(/<div class="article-main[^"]*"[^>]*>/gi, '');
  content = content.replace(/<div class="question-cell"[^>]*>/gi, '');
  content = content.replace(/<div class="question-widget"[^>]*>/gi, '');
  content = content.replace(/<div class="question-number-quiz"[^>]*>.*?<\/div>/gis, '');
  content = content.replace(/<div class="review-container"[^>]*>.*?<\/div>/gis, '');
  content = content.replace(/<div class="colorline-container"[^>]*>.*?<\/div>/gis, '');

  // Remove font-family styles
  content = content.replace(/font-family:\s*[^;]*;?\s*/gi, '');

  // Clean up whitespace
  content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');
  content = content.trim();

  return content;
}

// Process a single question with math-specific handling
function processQuestion(question, testId, examId) {
  try {
    const moduleType = mapModuleType(testId);
    const isGridIn = question.questionType === 'grid_in' || !question.choices || question.choices.length === 0;

    let processedQuestion = {
      exam_id: examId,
      question_number: question.questionNumber,
      module_type: moduleType,
      question_type: isGridIn ? 'grid_in' : 'multiple_choice',
      difficulty_level: 'medium',
      topic_tags: [getTopicFromModuleType(moduleType)],
      content_format: 'html'
    };

    // Process question content
    if (question.questionHTML) {
      processedQuestion.question_html = extractMainContentFromHtml(question.questionHTML);
      processedQuestion.question_text = question.questionText || '';
    } else {
      processedQuestion.question_html = null;
      processedQuestion.question_text = question.questionText || '';
      processedQuestion.content_format = 'markdown';
    }

    // Set backup fields (required)
    processedQuestion.question_markdown_backup = question.questionText || processedQuestion.question_html || 'No content';

    // Handle answers based on question type
    if (isGridIn) {
      // Grid-in: use correct_answers array
      const acceptableAnswers = generateAcceptableAnswers(question.correctAnswer);
      processedQuestion.correct_answers = acceptableAnswers;
      processedQuestion.correct_answer = acceptableAnswers[0] || question.correctAnswer || ""; // First acceptable answer as string
      processedQuestion.options = null; // null for grid-in
      processedQuestion.options_markdown_backup = null;

      console.log(`   ✅ Grid-in - Primary answer: "${processedQuestion.correct_answer}", All answers: ${JSON.stringify(acceptableAnswers)}`);
    } else {
      // Multiple choice: use correct_answer and options
      const options = convertChoicesToOptions(question.choices);
      const correctLetter = extractCorrectAnswerLetter(question.correctAnswer, question.choices);

      // Store just the correct letter as a string (NOT an object)
      processedQuestion.correct_answer = correctLetter;
      processedQuestion.correct_answers = null; // null for multiple choice
      processedQuestion.options = options;
      processedQuestion.options_markdown_backup = options;

      console.log(`   ✅ Multiple choice - Letter: ${correctLetter}, Option: "${options[correctLetter]}"`);
    }

    // Handle explanation
    processedQuestion.explanation = question.explanation || null;
    processedQuestion.explanation_markdown_backup = question.explanation || null;

    // Handle images (for non-HTML questions)
    if (processedQuestion.content_format === 'markdown') {
      const imageUrl = extractMainImageUrl(question.imageUrls);
      processedQuestion.question_image_url = imageUrl;
    } else {
      processedQuestion.question_image_url = null;
    }

    return processedQuestion;

  } catch (error) {
    console.error(`❌ Error processing question ${question.questionNumber}:`, error);
    return null;
  }
}

function getTopicFromModuleType(moduleType) {
  const topics = {
    'math1': 'algebra_problem_solving',
    'math2': 'advanced_math'
  };
  return topics[moduleType] || 'algebra_problem_solving';
}

// Extract main image URL (first URL, not base64)
function extractMainImageUrl(imageUrls) {
  if (!imageUrls || !Array.isArray(imageUrls)) return null;

  const urlImage = imageUrls.find(url =>
    typeof url === 'string' && url.startsWith('https://')
  );

  return urlImage || null;
}

// Create or get exam
async function createOrGetExam(testId, testName, totalQuestions) {
  const moduleType = mapModuleType(testId);

  // Clean up the test name to remove module info and Form parts
  let cleanedName = testName
    .replace(/Module\s*[12]\s*/gi, '') // Remove "Module 1" or "Module 2" completely with trailing space
    .replace(/module\s*[12]\s*/gi, '') // Remove "module 1" or "module 2" completely with trailing space
    .replace(/Form\s*[A-Z]\s*/gi, '')  // Remove "Form A", "Form B", etc. with trailing space
    .replace(/form\s*[a-z]\s*/gi, '')  // Remove "form a", "form b", etc. with trailing space
    .replace(/\bUs\b/gi, 'US')         // Change "Us" to "US" (case insensitive)
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .trim();

  let formattedDate = cleanedName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  let moduleTypeName = moduleType === 'math1' ? 'Math1' : 'Math2';
  const examTitle = `${formattedDate} ${moduleTypeName}`;

  // Check if exam exists
  let { data: existingExam, error: examError } = await supabase
    .from('exams')
    .select('id, title')
    .eq('title', examTitle)
    .single();

  if (examError && examError.code === 'PGRST116') {
    // Create new exam
    const { data: newExam, error: createError } = await supabase
      .from('exams')
      .insert([{
        title: examTitle,
        description: 'Math module auto import',
        time_limits: {
          [moduleType]: 35, // Both Math1 and Math2: 35min
          english1: 0,
          english2: 0,
          math1: moduleType === 'math1' ? 35 : 0,
          math2: moduleType === 'math2' ? 35 : 0
        },
        module_composition: {
          [moduleType]: true
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
        .select('id, question_number, question_type, correct_answers, correct_answer');

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

        // Log question types and answers
        data.forEach(q => {
          console.log(`   Q${q.question_number} (${q.question_type}): ${
            q.question_type === 'grid_in'
              ? `Primary: "${q.correct_answer}", All: ${JSON.stringify(q.correct_answers)}`
              : `Letter: "${q.correct_answer}"`
          }`);
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
async function processTestData(testFilter = null, questionLimit = null, dryRun = true, jsonFile = null) {
  try {
    console.log('🚀 Starting Math Bluebook SAT Import Process...\n');

    // Load data
    const defaultJsonFile = 'bluebook-sat-problems-june2025usamodule2.json';
    const fileName = jsonFile || defaultJsonFile;
    const dataPath = path.join(__dirname, fileName);

    // Check if file exists
    if (!fs.existsSync(dataPath)) {
      throw new Error(`JSON file not found: ${dataPath}`);
    }

    console.log(`📁 Loading data from: ${fileName}`);
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

    console.log(`📊 Loaded data with ${data.tests.length} tests`);

    // Filter tests
    let testsToProcess = data.tests;

    if (testFilter) {
      // If test filter is specified, use it
      testsToProcess = data.tests.filter(test =>
        test.testId.toLowerCase().includes(testFilter.toLowerCase())
      );
      console.log(`🔍 Filtered to ${testsToProcess.length} tests matching "${testFilter}"`);
    } else {
      // If no filter, try to identify math tests by various patterns
      testsToProcess = data.tests.filter(test => {
        const testId = test.testId.toLowerCase();
        return testId.includes('math') ||
               testId.includes('module_1') ||
               testId.includes('module_2') ||
               testId.includes('algebra') ||
               testId.includes('geometry') ||
               testId.includes('calculus');
      });
      console.log(`🔍 Auto-detected ${testsToProcess.length} potential math tests`);

      // If no math patterns found, process all tests
      if (testsToProcess.length === 0) {
        testsToProcess = data.tests;
        console.log(`🔍 No math patterns detected, processing all ${testsToProcess.length} tests`);
      }
    }

    if (testsToProcess.length === 0) {
      console.log('❌ No math tests found to process');
      return;
    }

    const totalResults = {
      testsProcessed: 0,
      questionsProcessed: 0,
      questionsSucceeded: 0,
      questionsFailed: 0,
      gridInQuestions: 0,
      multipleChoiceQuestions: 0,
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

        questionsToProcess.forEach((question, index) => {
          console.log(`   Question ${question.questionNumber}:`);
          console.log(`      Type: ${question.questionType || 'unknown'}`);
          console.log(`      Choices: ${question.choices?.length || 0}`);
          console.log(`      Original correct: "${question.correctAnswer}"`);

          const processed = processQuestion(question, test.testId, 'dummy-exam-id');
          if (processed) {
            console.log(`      → Question Type: ${processed.question_type}`);
            console.log(`      → Module: ${processed.module_type}`);

            if (processed.question_type === 'grid_in') {
              console.log(`      → Primary Answer: "${processed.correct_answer}"`);
              console.log(`      → All Acceptable: ${JSON.stringify(processed.correct_answers)}`);
              totalResults.gridInQuestions++;
            } else {
              console.log(`      → Options: ${JSON.stringify(processed.options)}`);
              console.log(`      → Correct Letter: "${processed.correct_answer}"`);
              console.log(`      → Correct Option: "${processed.options[processed.correct_answer]}"`);
              totalResults.multipleChoiceQuestions++;
            }

            // Show LaTeX extraction
            if (processed.question_html && processed.question_html.includes('$')) {
              console.log(`      → Contains LaTeX: ✅`);
            }
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
            if (processed.question_type === 'grid_in') {
              totalResults.gridInQuestions++;
            } else {
              totalResults.multipleChoiceQuestions++;
            }
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
    console.log('\n🎉 Math Import Process Complete!');
    console.log('='.repeat(50));
    console.log(`Tests processed: ${totalResults.testsProcessed}`);
    console.log(`Questions processed: ${totalResults.questionsProcessed}`);
    console.log(`Grid-in questions: ${totalResults.gridInQuestions}`);
    console.log(`Multiple choice questions: ${totalResults.multipleChoiceQuestions}`);

    if (!dryRun) {
      console.log(`Questions succeeded: ${totalResults.questionsSucceeded}`);
      console.log(`Questions failed: ${totalResults.questionsFailed}`);
      console.log(`Success rate: ${(totalResults.questionsSucceeded/totalResults.questionsProcessed*100).toFixed(1)}%`);

      if (totalResults.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        totalResults.errors.forEach(error => {
          console.log(`   Batch ${error.batch}: ${error.error}`);
        });
      }
    }

    // Save results to file
    const resultsPath = path.join(__dirname, `math-import-results-${Date.now()}.json`);
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
    jsonFile: null,
    dryRun: true
  };

  args.forEach(arg => {
    if (arg.startsWith('--test=')) {
      config.testFilter = arg.split('=')[1];
    } else if (arg.startsWith('--limit=')) {
      config.questionLimit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--file=') || arg.startsWith('--json=')) {
      config.jsonFile = arg.split('=')[1];
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

    console.log('⚙️ Math Import Configuration:');
    console.log(`   JSON file: ${config.jsonFile || 'bluebook-sat-problems-2025-09-24.json (default)'}`);
    console.log(`   Test filter: ${config.testFilter || 'math only'}`);
    console.log(`   Question limit: ${config.questionLimit || 'no limit'}`);
    console.log(`   Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE IMPORT'}`);
    console.log('');

    if (config.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be inserted');
      console.log('   Add --confirm flag to perform actual import');
      console.log('');
    }

    await processTestData(config.testFilter, config.questionLimit, config.dryRun, config.jsonFile);

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Help message
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
Math Bluebook SAT Importer

Features:
- Handles grid-in questions with multiple acceptable answer formats
- Extracts and converts LaTeX math expressions
- Improved math symbol matching
- Supports decimal/fraction conversions

Usage:
  node complete-bluebook-importer-math-improved.js [options]

Options:
  --file=<path>      JSON file to import (or --json=<path>)
  --test=<filter>    Filter tests by name (defaults to math only)
  --limit=<number>   Limit number of questions per test
  --dry-run          Preview mode (default)
  --confirm          Actually perform import
  --help, -h         Show this help

Examples:
  # Preview all math tests from custom JSON file
  node complete-bluebook-importer-math-improved.js --file=my-data.json --limit=3 --dry-run

  # Import specific math test from default JSON
  node complete-bluebook-importer-math-improved.js --test="math_module_1" --confirm

  # Import from different JSON file
  node complete-bluebook-importer-math-improved.js --json=another-file.json --confirm
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
  extractLatexFromHtml,
  generateAcceptableAnswers,
  normalizeMathExpression
};
