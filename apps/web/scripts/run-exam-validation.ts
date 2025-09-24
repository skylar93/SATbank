#!/usr/bin/env tsx

/**
 * Standalone script to run comprehensive exam validation
 * Usage: npx tsx scripts/run-exam-validation.ts
 */

import { config } from 'dotenv'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { runFullExamValidation, generateTestReport } from '../tests/utils/exam-test-runner'

// Load environment variables
config({ path: '.env.local' })

async function main() {
  console.log('🎯 SAT Bank - Comprehensive Exam Validation')
  console.log('=' .repeat(50))

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing required environment variables:')
    console.error('   - NEXT_PUBLIC_SUPABASE_URL')
    console.error('   - SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  try {
    // Run the full validation
    const results = await runFullExamValidation()

    // Print summary to console
    console.log('\n' + '='.repeat(50))
    console.log('🎯 VALIDATION COMPLETE')
    console.log('='.repeat(50))
    console.log(`📊 Success Rate: ${results.successRate.toFixed(1)}%`)
    console.log(`📝 Exams Tested: ${results.totalExamsTest}`)
    console.log(`📋 Total Questions: ${results.summary.totalQuestions}`)
    console.log(`🔢 Multiple Answer Questions: ${results.summary.totalMultipleAnswers}`)
    console.log(`❌ Total Issues: ${results.totalIssues}`)
    console.log(`⏱️  Average Processing Time: ${results.summary.averageProcessingTime.toFixed(0)}ms`)

    // Show failed exams
    const failedExams = results.results.filter(r => !r.success)
    if (failedExams.length > 0) {
      console.log('\n🚨 FAILED EXAMS:')
      failedExams.forEach(exam => {
        console.log(`   ❌ ${exam.examTitle} (${exam.issues.critical.length} critical, ${exam.issues.warnings.length} warnings)`)
      })
    }

    // Generate and save HTML report
    const htmlReport = generateTestReport(results)
    const reportPath = join(__dirname, '..', 'validation-reports', `exam-validation-${Date.now()}.html`)

    // Create directory if it doesn't exist
    const reportsDir = join(__dirname, '..', 'validation-reports')
    try {
      await import('fs').then(fs => fs.mkdirSync(reportsDir, { recursive: true }))
    } catch (e) {
      // Directory might already exist
    }

    writeFileSync(reportPath, htmlReport)
    console.log(`\n📄 Detailed report saved: ${reportPath}`)

    // Save JSON results for programmatic access
    const jsonPath = join(__dirname, '..', 'validation-reports', `exam-validation-${Date.now()}.json`)
    writeFileSync(jsonPath, JSON.stringify(results, null, 2))
    console.log(`📄 JSON results saved: ${jsonPath}`)

    // Exit with appropriate code
    if (results.totalIssues === 0) {
      console.log('\n✅ All tests passed! 🎉')
      process.exit(0)
    } else if (results.results.every(r => r.issues.critical.length === 0)) {
      console.log('\n⚠️  Some warnings found, but no critical issues')
      process.exit(0)
    } else {
      console.log('\n❌ Critical issues found - please review and fix')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n💥 FATAL ERROR:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// Add some helpful utilities
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🎯 SAT Bank Exam Validation Tool

Usage: npx tsx scripts/run-exam-validation.ts [options]

Options:
  --help, -h     Show this help message
  --quiet, -q    Reduce output verbosity
  --json-only    Only output JSON results (for CI/CD)

Examples:
  npx tsx scripts/run-exam-validation.ts
  npx tsx scripts/run-exam-validation.ts --quiet
  npx tsx scripts/run-exam-validation.ts --json-only

Environment Variables Required:
  NEXT_PUBLIC_SUPABASE_URL     - Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY    - Your Supabase service role key

This tool will:
  ✅ Validate all exam configurations
  ✅ Test question answer formats (including multiple answers)
  ✅ Verify scoring curve configurations
  ✅ Simulate exam attempts and score calculations
  ✅ Generate detailed HTML and JSON reports

Reports are saved to: apps/web/validation-reports/
  `)
  process.exit(0)
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error)
  process.exit(1)
})