const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read environment variables from apps/web
const envPath = path.join(__dirname, '../apps/web/.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1];
const supabaseKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1];

const supabase = createClient(supabaseUrl, supabaseKey);

function extractMainImageUrl(imageInfo) {
  // Extract the main image URL (usually the first URL type image)
  if (imageInfo && imageInfo.preview) {
    const preview = imageInfo.preview;
    if (preview.startsWith('https://')) {
      return preview.split('...')[0]; // Remove the "..." truncation
    }
  }
  return null;
}

function convertChoicesToOptions(choices) {
  // Convert ["A) option1", "B) option2"] to {"A": "option1", "B": "option2"}
  const options = {};
  
  choices.forEach(choice => {
    // Extract letter and text: "A) some text" -> "A", "some text"
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      options[letter] = text.trim();
    }
  });
  
  return options;
}

function extractCorrectAnswerLetter(correctAnswer, choices) {
  // Find which choice matches the correct answer
  for (const choice of choices) {
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      if (text.trim() === correctAnswer.trim()) {
        return letter;
      }
    }
  }
  
  // Fallback: try to find partial match
  for (const choice of choices) {
    const match = choice.match(/^([A-D])\)\s*(.*)$/);
    if (match) {
      const [, letter, text] = match;
      if (correctAnswer.includes(text.trim()) || text.trim().includes(correctAnswer)) {
        return letter;
      }
    }
  }
  
  return 'A'; // Default fallback
}

async function importAugust2023Questions() {
  try {
    // Load HTML cleaning test results
    const htmlResultsPath = path.join(__dirname, 'html-cleaning-test-results.json');
    const htmlResults = JSON.parse(fs.readFileSync(htmlResultsPath, 'utf8'));
    
    // Load August 2023 data
    const bluebookPath = path.join(__dirname, 'bluebook-sat-problems-2025-09-01.json');
    const bluebookData = JSON.parse(fs.readFileSync(bluebookPath, 'utf8'));
    const august2023 = bluebookData.tests.find(test => test.testId === 'module_1_august_2023');
    
    if (!august2023) {
      console.error('August 2023 Module 1 not found in bluebook data');
      return;
    }
    
    // Focus on questions 11 and 12 from HTML results
    const htmlQ11 = htmlResults.find(q => q.questionNumber === 11);
    const htmlQ12 = htmlResults.find(q => q.questionNumber === 12);
    const originalQ11 = august2023.questions[10]; // 0-indexed
    const originalQ12 = august2023.questions[11]; // 0-indexed
    
    if (!htmlQ11 || !htmlQ12 || !originalQ11 || !originalQ12) {
      console.error('Could not find questions 11 and 12 in both datasets');
      return;
    }
    
    console.log('=== Processing Question 11 ===');
    console.log('Original text preview:', originalQ11.questionText?.slice(0, 100) + '...');
    console.log('HTML cleaned text preview:', htmlQ11.cleanedHTML?.slice(0, 100) + '...');
    console.log('Image URL from HTML:', extractMainImageUrl(htmlQ11.imageInfo));
    console.log('Options from HTML:', htmlQ11.choices);
    console.log('Correct answer from HTML:', htmlQ11.correctAnswer);
    
    console.log('\n=== Processing Question 12 ===');
    console.log('Original text preview:', originalQ12.questionText?.slice(0, 100) + '...');
    console.log('HTML cleaned text preview:', htmlQ12.cleanedHTML?.slice(0, 100) + '...');
    console.log('Image URL from HTML:', extractMainImageUrl(htmlQ12.imageInfo));
    console.log('Options from HTML:', htmlQ12.choices);
    console.log('Correct answer from HTML:', htmlQ12.correctAnswer);
    
    // Process questions for import
    const questionsToImport = [
      {
        questionNumber: 11,
        originalData: originalQ11,
        htmlData: htmlQ11,
        processedOptions: convertChoicesToOptions(htmlQ11.choices),
        correctAnswerLetter: extractCorrectAnswerLetter(htmlQ11.correctAnswer, htmlQ11.choices),
        imageUrl: extractMainImageUrl(htmlQ11.imageInfo)
      },
      {
        questionNumber: 12,
        originalData: originalQ12,
        htmlData: htmlQ12,
        processedOptions: convertChoicesToOptions(htmlQ12.choices),
        correctAnswerLetter: extractCorrectAnswerLetter(htmlQ12.correctAnswer, htmlQ12.choices),
        imageUrl: extractMainImageUrl(htmlQ12.imageInfo)
      }
    ];
    
    console.log('\n=== Processed Data for Import ===');
    questionsToImport.forEach((q, index) => {
      console.log(`\nQuestion ${q.questionNumber}:`);
      console.log('  Processed options:', JSON.stringify(q.processedOptions, null, 2));
      console.log('  Correct answer letter:', q.correctAnswerLetter);
      console.log('  Image URL:', q.imageUrl);
      console.log('  Question text length:', (q.originalData.questionText || '').length);
      console.log('  HTML cleaned length:', (q.htmlData.cleanedHTML || '').length);
    });
    
    // Ask for user confirmation before importing
    console.log('\n=== Ready for Import ===');
    console.log('This will import 2 questions (11 and 12) from August 2023 Module 1 to the database.');
    console.log('Run this script with --confirm flag to actually perform the import.');
    
    if (process.argv.includes('--confirm')) {
      console.log('\nStarting import...');
      await performImport(questionsToImport);
    } else {
      console.log('\nDry run completed. Add --confirm flag to actually import.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function performImport(questionsToImport) {
  // First, get or create the exam
  const examTitle = 'August 2023 SAT - Module 1 (Test Import)';
  
  let { data: existingExam, error: examError } = await supabase
    .from('exams')
    .select('id')
    .eq('title', examTitle)
    .single();
    
  let examId;
  
  if (examError && examError.code === 'PGRST116') {
    // Exam doesn't exist, create it
    const { data: newExam, error: createError } = await supabase
      .from('exams')
      .insert([{
        title: examTitle,
        description: 'Import test for August 2023 Module 1 questions with images',
        time_limits: {
          english1: 64, // 64 minutes for module 1
          english2: 0,
          math1: 0,
          math2: 0
        },
        total_questions: 2,
        is_active: true,
        is_mock_exam: false,
        is_custom_assignment: true,
        answer_check_mode: 'exam_end'
      }])
      .select()
      .single();
      
    if (createError) {
      console.error('Error creating exam:', createError);
      return;
    }
    
    examId = newExam.id;
    console.log('Created new exam:', examId);
  } else if (examError) {
    console.error('Error finding exam:', examError);
    return;
  } else {
    examId = existingExam.id;
    console.log('Using existing exam:', examId);
  }
  
  // Import questions
  for (const q of questionsToImport) {
    try {
      // Use original question text but with HTML cleaned version as backup
      const questionText = q.originalData.questionText || q.htmlData.cleanedHTML;
      
      const questionData = {
        exam_id: examId,
        question_number: q.questionNumber,
        module_type: 'english1',
        question_type: 'multiple_choice',
        question_text: questionText,
        options: q.processedOptions,
        correct_answer: [q.correctAnswerLetter], // Array format
        question_image_url: q.imageUrl,
        explanation: q.originalData.explanation || null,
        difficulty_level: 'medium',
        topic_tags: ['reading_comprehension']
      };
      
      const { data, error } = await supabase
        .from('questions')
        .upsert(questionData, {
          onConflict: 'exam_id,question_number,module_type'
        })
        .select();
        
      if (error) {
        console.error(`Error importing question ${q.questionNumber}:`, error);
      } else {
        console.log(`✅ Successfully imported question ${q.questionNumber}`);
        console.log('   Question ID:', data[0].id);
        console.log('   Image URL:', data[0].question_image_url);
      }
    } catch (err) {
      console.error(`Error processing question ${q.questionNumber}:`, err);
    }
  }
  
  console.log('\n🎉 Import completed!');
}

// Run the script
importAugust2023Questions();