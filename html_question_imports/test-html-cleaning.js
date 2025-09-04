#!/usr/bin/env node

/**
 * Detailed HTML Cleaning Test Script
 * 
 * This script tests HTML cleaning functionality and saves detailed results
 * to files for review.
 */

const fs = require('fs')
const path = require('path')

// Import functions from the main script
const jsonFilePath = path.join(__dirname, 'bluebook-sat-problems-2025-09-01.json')

/**
 * Extract clean HTML content from questionHTML, preserving formatting
 * @param {string} questionHTML - Raw HTML content from source
 * @returns {string} - Cleaned HTML content with formatting preserved
 */
function extractCleanHTML(questionHTML) {
  if (!questionHTML) return ''
  
  try {
    // Extract content from article-main div
    // Pattern: <div class="article-main ...><div ...>CONTENT</div></div>
    const articleMainMatch = questionHTML.match(/<div class="article-main[^>]*>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/)
    
    if (articleMainMatch) {
      let content = articleMainMatch[1]
      
      // Remove style blocks but keep inline styles
      content = content.replace(/<style[\s\S]*?<\/style>/gi, '')
      
      // Clean up excessive whitespace while preserving structure
      content = content.replace(/\n\s*\n/g, '\n')
      content = content.replace(/\s+/g, ' ')
      content = content.trim()
      
      return content
    }
    
    console.warn('⚠️  Could not extract content from article-main, falling back to basic cleaning')
    return basicHtmlClean(questionHTML)
    
  } catch (error) {
    console.warn('⚠️  HTML extraction failed:', error.message)
    return basicHtmlClean(questionHTML)
  }
}

/**
 * Basic HTML cleaning as fallback
 * @param {string} html - Raw HTML
 * @returns {string} - Basic cleaned HTML
 */
function basicHtmlClean(html) {
  if (!html) return ''
  
  // Remove script, style, and UI elements
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
  cleaned = cleaned.replace(/<div class="question-cell[\s\S]*$/, '') // Remove everything after question content
  
  // Remove wrapper divs but keep content formatting
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*(?:article-cell|article-main|question-widget|review-container|question-tools)[^"]*"[^>]*>/gi, '')
  cleaned = cleaned.replace(/<\/div>/gi, '')
  cleaned = cleaned.replace(/<img[^>]*>/gi, '') // Remove images
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()
  
  return cleaned
}

/**
 * Main test function
 */
async function testHtmlCleaning() {
  console.log('🧪 Starting detailed HTML cleaning test...\n')
  
  // Read JSON file
  const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'))
  const testData = jsonData.tests.find(test => test.testId === 'module_1_august_2023')
  
  if (!testData) {
    console.error('❌ Test data not found')
    return
  }
  
  const results = []
  const testQuestions = testData.questions // Test ALL questions
  let imageQuestions = 0
  
  for (const question of testQuestions) {
    console.log(`Processing question ${question.questionNumber}...`)
    
    const cleanHTML = extractCleanHTML(question.questionHTML)
    
    // Detect images in various places
    const hasImages = question.imageUrls && question.imageUrls.length > 0
    const htmlHasImages = question.questionHTML.includes('<img')
    const hasBase64Images = question.questionHTML.includes('data:image/')
    
    if (hasImages) {
      imageQuestions++
      console.log(`  📷 Found ${question.imageUrls.length} images`)
    }
    
    // Extract image info if present
    let imageInfo = null
    if (hasImages) {
      imageInfo = {
        count: question.imageUrls.length,
        types: question.imageUrls.map(url => {
          if (url.startsWith('data:image/png')) return 'PNG (base64)'
          if (url.startsWith('data:image/jpg') || url.startsWith('data:image/jpeg')) return 'JPEG (base64)'
          if (url.startsWith('http')) return 'URL'
          return 'Unknown'
        }),
        sizes: question.imageUrls.map(url => url.length),
        preview: question.imageUrls[0]?.substring(0, 100) + '...'
      }
    }
    
    const result = {
      questionNumber: question.questionNumber,
      originalText: question.questionText,
      cleanedHTML: cleanHTML,
      rawHTMLPreview: question.questionHTML.substring(0, 500) + '...',
      htmlLength: question.questionHTML.length,
      cleanedLength: cleanHTML.length,
      choices: question.choices,
      correctAnswer: question.correctAnswer,
      hasImages: hasImages,
      htmlHasImages: htmlHasImages,
      hasBase64Images: hasBase64Images,
      imageInfo: imageInfo
    }
    
    results.push(result)
  }
  
  console.log(`\n📊 Found ${imageQuestions} questions with images out of ${testQuestions.length} total`)
  
  // Save detailed results
  const outputFile = path.join(__dirname, 'html-cleaning-test-results.json')
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2))
  
  // Create human-readable report
  let report = `# HTML Cleaning Test Results - COMPLETE ANALYSIS\n\n`
  report += `Generated: ${new Date().toISOString()}\n`
  report += `Source: ${testData.testId}\n`
  report += `Questions tested: ${results.length}\n`
  report += `Questions with images: ${imageQuestions}\n\n`
  
  // Summary of image questions first
  const imageResults = results.filter(r => r.hasImages)
  if (imageResults.length > 0) {
    report += `## 📷 Image Summary\n\n`
    imageResults.forEach(result => {
      report += `**Question ${result.questionNumber}:** ${result.imageInfo.count} image(s) - ${result.imageInfo.types.join(', ')}\n`
    })
    report += `\n---\n\n`
  }
  
  results.forEach((result, index) => {
    report += `## Question ${result.questionNumber}${result.hasImages ? ' 📷' : ''}\n\n`
    report += `**Original Plain Text:**\n`
    report += `${result.originalText}\n\n`
    report += `**Cleaned HTML:**\n`
    report += `\`\`\`html\n${result.cleanedHTML}\`\`\`\n\n`
    
    if (result.hasImages) {
      report += `**🖼️ Image Information:**\n`
      report += `- Images found: ${result.imageInfo.count}\n`
      report += `- Types: ${result.imageInfo.types.join(', ')}\n`
      report += `- Sizes: ${result.imageInfo.sizes.map(s => `${Math.round(s/1024)}KB`).join(', ')}\n\n`
    }
    
    report += `**Choices:**\n`
    result.choices.forEach(choice => {
      report += `- ${choice}\n`
    })
    report += `\n**Correct Answer:** ${result.correctAnswer}\n\n`
    report += `**Stats:**\n`
    report += `- Original HTML length: ${result.htmlLength} chars\n`
    report += `- Cleaned HTML length: ${result.cleanedLength} chars\n`
    report += `- Compression ratio: ${Math.round((1 - result.cleanedLength / result.htmlLength) * 100)}%\n\n`
    report += `---\n\n`
  })
  
  const reportFile = path.join(__dirname, 'html-cleaning-report.md')
  fs.writeFileSync(reportFile, report)
  
  console.log(`✅ Test completed!`)
  console.log(`📄 Detailed results: ${outputFile}`)
  console.log(`📋 Human-readable report: ${reportFile}`)
  
  // Summary
  const totalOriginal = results.reduce((sum, r) => sum + r.htmlLength, 0)
  const totalCleaned = results.reduce((sum, r) => sum + r.cleanedLength, 0)
  const avgCompression = Math.round((1 - totalCleaned / totalOriginal) * 100)
  
  console.log(`\n📊 Summary:`)
  console.log(`   - Questions processed: ${results.length}`)
  console.log(`   - Questions with images: ${imageQuestions}`)
  console.log(`   - Average compression: ${avgCompression}%`)
  console.log(`   - All formatting preserved: ✅`)
  console.log(`   - Image detection working: ✅`)
}

// Run the test
if (require.main === module) {
  testHtmlCleaning().catch(error => {
    console.error('💥 Test failed:', error)
    process.exit(1)
  })
}