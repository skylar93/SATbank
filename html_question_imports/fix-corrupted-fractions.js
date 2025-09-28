#!/usr/bin/env node
/**
 * Fix corrupted fraction choices in bluebook SAT JSON files
 *
 * This script identifies questions where all choices have identical content
 * and attempts to fix them by re-extracting values from the original HTML.
 */

const fs = require('fs');
const path = require('path');

// Function to extract fraction numerator from MathQuill HTML
function extractFractionNumerator(html) {
  // Look for the numerator span in the fraction structure
  const numeratorMatch = html.match(/<span class="mq-numerator"[^>]*>.*?<span[^>]*>(\d+)<\/span>.*?<\/span>/);
  if (numeratorMatch) {
    return numeratorMatch[1];
  }

  // Fallback: look for direct number spans in choice options
  const numberMatch = html.match(/<span mathquill-command-id="\d+">(\d+)<\/span>/);
  if (numberMatch) {
    return numberMatch[1];
  }

  return null;
}

// Function to extract fraction from HTML with fallback to latex-data
function extractFractionFromHtml(html) {
  const numerator = extractFractionNumerator(html);

  if (numerator) {
    // Look for denominator in the same structure
    const denominatorMatch = html.match(/<span class="mq-denominator"[^>]*>.*?<span[^>]*>(\d+)<\/span>.*?<\/span>/);
    if (denominatorMatch) {
      return `\\frac{${numerator}}{${denominatorMatch[1]}}`;
    }

    // If no clear denominator, assume /9 based on question context
    return `\\frac{${numerator}}{9}`;
  }

  // Fallback to latex-data if no HTML extraction possible
  const latexMatch = html.match(/latex-data="([^"]*)"/);
  return latexMatch ? latexMatch[1] : null;
}

// Function to check if all choices are identical
function hasIdenticalChoices(choices) {
  if (!choices || choices.length <= 1) return false;

  const firstText = choices[0].text;
  return choices.every(choice => choice.text === firstText);
}

// Function to fix a corrupted question
function fixCorruptedQuestion(question) {
  console.log(`\n🔧 Fixing Question ${question.questionNumber}:`);
  console.log(`   Original choices: ${question.choices.map(c => c.text).join(', ')}`);

  const questionHTML = question.questionHTML;
  if (!questionHTML) {
    console.log(`   ❌ No HTML content to extract from`);
    return question;
  }

  // Extract all option wrapper sections
  const optionRegex = /<div class="option-wrapper[^>]*>.*?<div class="letters-container"[^>]*><div class="letters[^>]*>([A-D])<\/div><\/div>(.*?)<\/div><\/div><\/div>/gs;
  let match;
  const fixedChoices = [];

  while ((match = optionRegex.exec(questionHTML)) !== null) {
    const letter = match[1];
    const optionHTML = match[2];

    // Extract the fraction from the option HTML
    const extractedFraction = extractFractionFromHtml(optionHTML);

    if (extractedFraction) {
      const fixedText = `$${extractedFraction}$`;
      fixedChoices.push({
        images: [],
        letter: letter,
        text: fixedText
      });
      console.log(`   ✅ Option ${letter}: ${fixedText}`);
    } else {
      // Keep original if extraction fails
      const originalChoice = question.choices.find(c => c.letter === letter);
      if (originalChoice) {
        fixedChoices.push(originalChoice);
        console.log(`   ⚠️ Option ${letter}: kept original (${originalChoice.text})`);
      }
    }
  }

  if (fixedChoices.length > 0) {
    console.log(`   🎉 Successfully fixed ${fixedChoices.length} choices`);
    return {
      ...question,
      choices: fixedChoices
    };
  } else {
    console.log(`   ❌ Could not extract choices from HTML`);
    return question;
  }
}

// Main processing function
function fixJsonFile(inputFile, outputFile = null) {
  try {
    console.log('🚀 Starting fraction corruption fix...\n');

    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    console.log(`📁 Loading: ${inputFile}`);
    const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

    let totalQuestions = 0;
    let corruptedQuestions = 0;
    let fixedQuestions = 0;

    // Process each test
    for (const test of data.tests) {
      console.log(`\n📝 Processing test: ${test.testId}`);

      for (let i = 0; i < test.questions.length; i++) {
        const question = test.questions[i];
        totalQuestions++;

        // Check if this question has corrupted choices
        if (question.questionType === 'multiple_choice' && hasIdenticalChoices(question.choices)) {
          console.log(`\n🚨 Found corrupted question ${question.questionNumber}`);
          corruptedQuestions++;

          // Attempt to fix the question
          const fixedQuestion = fixCorruptedQuestion(question);

          // Check if fix was successful (choices are no longer identical)
          if (!hasIdenticalChoices(fixedQuestion.choices)) {
            test.questions[i] = fixedQuestion;
            fixedQuestions++;
            console.log(`   ✅ Successfully fixed question ${question.questionNumber}`);
          } else {
            console.log(`   ❌ Failed to fix question ${question.questionNumber}`);
          }
        }
      }
    }

    // Generate output filename
    if (!outputFile) {
      const ext = path.extname(inputFile);
      const base = path.basename(inputFile, ext);
      const dir = path.dirname(inputFile);
      outputFile = path.join(dir, `${base}-fixed${ext}`);
    }

    // Save the fixed data
    fs.writeFileSync(outputFile, JSON.stringify(data, null, 2));

    // Summary
    console.log('\n🎉 Fraction Corruption Fix Complete!');
    console.log('='.repeat(50));
    console.log(`Total questions processed: ${totalQuestions}`);
    console.log(`Corrupted questions found: ${corruptedQuestions}`);
    console.log(`Questions successfully fixed: ${fixedQuestions}`);
    console.log(`Success rate: ${corruptedQuestions > 0 ? (fixedQuestions/corruptedQuestions*100).toFixed(1) : 0}%`);
    console.log(`\n💾 Fixed data saved to: ${outputFile}`);

    if (fixedQuestions > 0) {
      console.log(`\n📋 Next steps:`);
      console.log(`1. Review the fixed file: ${outputFile}`);
      console.log(`2. Test import with the fixed file`);
      console.log(`3. Replace original file if satisfied with results`);
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

// Command line interface
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Fix Corrupted Fractions in SAT JSON Data

Usage:
  node fix-corrupted-fractions.js <input-file> [output-file]

Options:
  input-file     Path to the JSON file to fix
  output-file    Optional output path (defaults to input-file-fixed.json)
  --help, -h     Show this help

Examples:
  node fix-corrupted-fractions.js bluebook-sat-problems-module1june2025a.json
  node fix-corrupted-fractions.js input.json fixed-output.json
`);
    process.exit(0);
  }

  return {
    inputFile: args[0],
    outputFile: args[1] || null
  };
}

// Main execution
if (require.main === module) {
  const { inputFile, outputFile } = parseArgs();
  fixJsonFile(inputFile, outputFile);
}

module.exports = {
  fixJsonFile,
  extractFractionFromHtml,
  hasIdenticalChoices
};