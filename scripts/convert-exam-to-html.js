#!/usr/bin/env node

/**
 * Targeted HTML Conversion Script
 * Safely converts a specific exam from Markdown to HTML format
 * 
 * Usage: node scripts/convert-exam-to-html.js <exam_id>
 * Example: node scripts/convert-exam-to-html.js 6f4eb255-3d1a-4e4c-90f3-99364b63c91a
 */

const { createClient } = require('@supabase/supabase-js');
const { marked } = require('marked');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../apps/web/.env.local') });

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Configure marked for safe HTML conversion
 */
function configureMarked() {
  marked.setOptions({
    headerIds: false,
    mangle: false,
    breaks: true,  // This converts single \n to <br>
    gfm: true,
    sanitize: false, // We'll handle sanitization separately if needed
  });
}

/**
 * Process LaTeX math expressions and convert to proper HTML format
 * @param {string} text - The text containing LaTeX expressions
 * @returns {string} - The text with LaTeX converted to data-math spans
 */
function processLatexMath(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // Handle display math ($$...$$)
  text = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    const cleanLatex = latex.trim();
    // Properly escape HTML entities in the data attribute
    const escapedLatex = cleanLatex
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<span data-math="${escapedLatex}" data-inline="false"></span>`;
  });

  // Handle inline math ($...$) - be more careful to avoid false positives
  text = text.replace(/\$([^$\n]+?)\$/g, (match, latex) => {
    const cleanLatex = latex.trim();
    // Properly escape HTML entities in the data attribute
    const escapedLatex = cleanLatex
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<span data-math="${escapedLatex}" data-inline="true"></span>`;
  });

  return text;
}

/**
 * Custom preprocessing for special markdown patterns
 * @param {string} text - The markdown text to preprocess
 * @returns {string} - The preprocessed text
 */
function preprocessCustomMarkdown(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  // IMPORTANT: Handle literal \n strings that were incorrectly stored in the database
  // Some data has literal "\\n" strings instead of actual newlines
  text = text.replace(/\\n/g, '\n');

  // Handle escaped dollar signs first (before LaTeX processing)
  text = text.replace(/\\(\$)/g, '___ESCAPED_DOLLAR___');

  // Handle ::text:: for center alignment BEFORE processing LaTeX
  // This way we can properly handle the math expressions within the center tags
  text = text.replace(/::([\s\S]*?)::/g, (match, content) => {
    // Process LaTeX within the center tags first
    let processedContent = processLatexMath(content);
    
    // Convert newlines to <br> tags within center content
    processedContent = processedContent.replace(/\n/g, '<br>');
    
    // Convert any remaining markdown formatting within the center tags
    // Convert **text** to <strong>text</strong> within center tags
    processedContent = processedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Convert *text* to <em>text</em> within center tags  
    processedContent = processedContent.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
    
    return `<div style="text-align: center; font-weight: bold;">${processedContent}</div>`;
  });

  // Process LaTeX after handling center alignment (for content outside :: tags)
  text = processLatexMath(text);
  
  // Handle em dash conversion (--- to —)
  text = text.replace(/---/g, '—');
  
  // Handle blank spaces (multiple underscores for fill-in-the-blank)
  // Convert sequences of 4+ underscores to proper blank spaces
  text = text.replace(/_{4,}/g, (match) => {
    const underscoreCount = match.length;
    // Use a distinctive placeholder that won't be processed by markdown
    return `<span class="fill-blank" style="display: inline-block; border-bottom: 1px solid #000; width: ${Math.max(60, underscoreCount * 10)}px; height: 1.2em;"></span>`;
  });
  
  // Handle __text__ for underline (prevent marked from turning it into bold)
  // Use word boundaries to avoid conflicts with fill-in blanks
  text = text.replace(/\b__([^_\n]+?)__\b/g, '<u>$1</u>');

  // Restore escaped dollar signs as plain text
  text = text.replace(/___ESCAPED_DOLLAR___/g, '$');
  
  return text;
}

/**
 * Clean up HTML formatting and handle proper paragraph spacing
 * @param {string} html - The HTML content to process
 * @returns {string} - The cleaned HTML
 */
function cleanHtmlFormatting(html) {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  // The marked library converts \n\n to separate <p> tags, but we want more visual spacing
  // Convert paragraph breaks to have proper spacing that represents double newlines
  
  // Remove trailing \n characters that marked might leave behind
  html = html.replace(/\n$/, '');
  
  // Add proper spacing between paragraphs to represent double newlines
  // Replace </p>\n<p> with </p><br><p> to create visual double-line break
  html = html.replace(/<\/p>\s*\n\s*<p>/g, '</p><br><p>');
  
  // Clean up excessive breaks - limit to maximum of double breaks
  html = html.replace(/(<br\s*\/?>){3,}/g, '<br><br>');
  
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  
  // Clean up leading/trailing breaks within paragraphs
  html = html.replace(/<p>\s*(<br\s*\/?>)+/g, '<p>');
  html = html.replace(/(<br\s*\/?>)+\s*<\/p>/g, '</p>');
  
  // Final cleanup - remove any remaining trailing whitespace
  html = html.trim();
  
  return html;
}

/**
 * Convert markdown text to HTML safely
 * @param {string} markdownText - The markdown text to convert
 * @returns {string} - The converted HTML
 */
function convertMarkdownToHtml(markdownText) {
  if (!markdownText || typeof markdownText !== 'string') {
    return markdownText;
  }
  
  try {
    // First, preprocess custom patterns
    let processedText = preprocessCustomMarkdown(markdownText);
    
    // Normalize multiple newlines - marked will handle the conversion properly
    processedText = processedText.replace(/\n{3,}/g, '\n\n'); // Normalize excessive newlines
    
    // Convert with marked (breaks:true will handle \n -> <br>)
    let html = marked.parse(processedText);
    
    // Clean up the HTML output
    html = cleanHtmlFormatting(html);
    
    return html;
  } catch (error) {
    console.warn('⚠️  Failed to convert markdown, keeping original:', error.message);
    return markdownText;
  }
}

/**
 * Convert options array from markdown to HTML
 * @param {Array} options - Array of option objects
 * @returns {Array} - Array with converted HTML options
 */
function convertOptionsToHtml(options) {
  if (!Array.isArray(options)) {
    return options;
  }

  return options.map(option => {
    if (typeof option === 'object' && option.text) {
      return {
        ...option,
        text: convertMarkdownToHtml(option.text)
      };
    }
    return option;
  });
}

/**
 * Main conversion function
 */
async function convertExamToHtml() {
  // Validate command line argument
  const examId = process.argv[2];
  if (!examId) {
    console.error('❌ Please provide an exam_id to convert.');
    console.error('Usage: node scripts/convert-exam-to-html.js <exam_id>');
    process.exit(1);
  }

  console.log(`🎯 Starting HTML conversion for exam: ${examId}`);

  try {
    // Configure markdown parser
    configureMarked();

    // Step 1: Fetch exam info
    const { data: examInfo, error: examError } = await supabase
      .from('exams')
      .select('title, total_questions')
      .eq('id', examId)
      .single();

    if (examError) {
      console.error('❌ Failed to fetch exam info:', examError.message);
      process.exit(1);
    }

    if (!examInfo) {
      console.error(`❌ Exam with ID ${examId} not found`);
      process.exit(1);
    }

    console.log(`📚 Found exam: "${examInfo.title}" (${examInfo.total_questions} questions)`);

    // Step 2: Fetch all questions for this exam
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select(`
        id, 
        question_number, 
        module_type,
        question_markdown_backup, 
        options_markdown_backup, 
        explanation_markdown_backup
      `)
      .eq('exam_id', examId)
      .order('question_number');

    if (questionsError) {
      console.error('❌ Failed to fetch questions:', questionsError.message);
      process.exit(1);
    }

    console.log(`📝 Found ${questions.length} questions to convert`);

    if (questions.length === 0) {
      console.log('✅ No questions found for this exam. Nothing to convert.');
      return;
    }

    // Step 3: Convert each question
    let convertedCount = 0;
    let failedCount = 0;

    for (const question of questions) {
      const { id, question_number, module_type } = question;
      
      console.log(`🔄 Converting question ${question_number} (${module_type})...`);

      try {
        // Convert markdown to HTML
        const questionHtml = convertMarkdownToHtml(question.question_markdown_backup);
        const optionsHtml = convertOptionsToHtml(question.options_markdown_backup);
        const explanationHtml = convertMarkdownToHtml(question.explanation_markdown_backup);

        // Update the database with HTML versions
        const { error: updateError } = await supabase
          .from('questions')
          .update({
            question_html: questionHtml,
            options_html: optionsHtml,
            explanation_html: explanationHtml,
            // Also update the regular columns for backward compatibility
            question_text: questionHtml,
            options: optionsHtml,
            explanation: explanationHtml,
            html_migration_status: 'converted'
          })
          .eq('id', id);

        if (updateError) {
          console.error(`❌ Failed to update question ${question_number}:`, updateError.message);
          
          // Mark as failed in database
          await supabase
            .from('questions')
            .update({ html_migration_status: 'failed' })
            .eq('id', id);
            
          failedCount++;
        } else {
          console.log(`✅ Converted question ${question_number}`);
          convertedCount++;
        }

      } catch (error) {
        console.error(`❌ Error processing question ${question_number}:`, error.message);
        
        // Mark as failed in database
        await supabase
          .from('questions')
          .update({ html_migration_status: 'failed' })
          .eq('id', id);
          
        failedCount++;
      }
    }

    // Step 4: Summary report
    console.log('\n📊 Conversion Summary:');
    console.log(`✅ Successfully converted: ${convertedCount} questions`);
    console.log(`❌ Failed conversions: ${failedCount} questions`);
    console.log(`📊 Total processed: ${questions.length} questions`);

    if (failedCount === 0) {
      console.log('\n🎉 Conversion completed successfully! All questions converted to HTML.');
      console.log(`🔍 You can now review the HTML content for exam: ${examId}`);
      console.log(`📝 Original markdown data is safely preserved in the *_markdown_backup columns`);
    } else {
      console.log(`\n⚠️  Conversion completed with ${failedCount} failures.`);
      console.log('Check the html_migration_status column for failed questions.');
    }

  } catch (error) {
    console.error('❌ Unexpected error during conversion:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Execute the conversion
if (require.main === module) {
  convertExamToHtml();
}

module.exports = { convertExamToHtml };