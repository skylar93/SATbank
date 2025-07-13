import { AnalyticsService, type ComprehensiveResults, type QuestionAnalysis } from './analytics-service'
import { TestAttempt } from './exam-service'

export class ExportService {
  // Export student results to CSV
  static exportStudentResultsToCSV(results: ComprehensiveResults): string {
    const { attempt, detailedScore, questionAnalysis, performanceAnalytics } = results

    // Header for student results CSV
    const headers = [
      'Student Name',
      'Test Completion Date',
      'Total Score (1600)',
      'Evidence-Based Reading & Writing',
      'Math Score',
      'Overall Accuracy %',
      'English 1 Score',
      'English 1 Accuracy %',
      'English 2 Score', 
      'English 2 Accuracy %',
      'Math 1 Score',
      'Math 1 Accuracy %',
      'Math 2 Score',
      'Math 2 Accuracy %',
      'Total Time Spent (minutes)',
      'Average Time Per Question (seconds)',
      'Questions Correct',
      'Total Questions',
      'Easy Questions Accuracy %',
      'Medium Questions Accuracy %',
      'Hard Questions Accuracy %'
    ]

    const data = [
      'Student', // Would need to fetch student name
      attempt.completed_at || '',
      detailedScore.totalScore.toString(),
      detailedScore.evidenceBasedReading.toString(),
      detailedScore.mathScore.toString(),
      Math.round(detailedScore.percentages.overall).toString(),
      detailedScore.rawScores.english1.toString(),
      Math.round(detailedScore.percentages.english1).toString(),
      detailedScore.rawScores.english2.toString(),
      Math.round(detailedScore.percentages.english2).toString(),
      detailedScore.rawScores.math1.toString(),
      Math.round(detailedScore.percentages.math1).toString(),
      detailedScore.rawScores.math2.toString(),
      Math.round(detailedScore.percentages.math2).toString(),
      Math.round(performanceAnalytics.totalTimeSpent / 60).toString(),
      Math.round(performanceAnalytics.averageTimePerQuestion).toString(),
      performanceAnalytics.correctAnswers.toString(),
      performanceAnalytics.totalQuestions.toString(),
      Math.round(performanceAnalytics.difficultyBreakdown.easy.percentage).toString(),
      Math.round(performanceAnalytics.difficultyBreakdown.medium.percentage).toString(),
      Math.round(performanceAnalytics.difficultyBreakdown.hard.percentage).toString()
    ]

    return [headers.join(','), data.join(',')].join('\n')
  }

  // Export question-by-question analysis to CSV
  static exportQuestionAnalysisToCSV(questionAnalysis: QuestionAnalysis[]): string {
    const headers = [
      'Question Number',
      'Module',
      'Difficulty',
      'User Answer',
      'Correct Answer',
      'Is Correct',
      'Time Spent (seconds)',
      'Topics'
    ]

    const rows = questionAnalysis.map(q => [
      q.questionNumber.toString(),
      q.moduleType,
      q.difficulty,
      q.userAnswer || 'No Answer',
      q.correctAnswer,
      q.isCorrect ? 'Yes' : 'No',
      q.timeSpent.toString(),
      q.topicTags.join('; ')
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    return csvContent
  }

  // Export admin dashboard data to CSV
  static exportAdminDataToCSV(attempts: any[]): string {
    const headers = [
      'Student Name',
      'Email',
      'Test Date',
      'Total Score',
      'English 1 Score',
      'English 2 Score', 
      'Math 1 Score',
      'Math 2 Score',
      'Test Duration',
      'Status'
    ]

    const rows = attempts.map(attempt => [
      attempt.user_profiles?.full_name || 'Unknown',
      attempt.user_profiles?.email || '',
      attempt.completed_at || attempt.started_at || '',
      (attempt.total_score || 0).toString(),
      (attempt.module_scores?.english1 || 0).toString(),
      (attempt.module_scores?.english2 || 0).toString(),
      (attempt.module_scores?.math1 || 0).toString(),
      (attempt.module_scores?.math2 || 0).toString(),
      this.calculateDuration(attempt.started_at, attempt.completed_at),
      attempt.status
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    return csvContent
  }

  // Download CSV file
  static downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Export student results with automatic download
  static async exportStudentResults(attemptId: string): Promise<void> {
    try {
      const results = await AnalyticsService.getComprehensiveResults(attemptId)
      
      // Export summary
      const summaryCSV = this.exportStudentResultsToCSV(results)
      const summaryFilename = `sat-results-summary-${attemptId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`
      this.downloadCSV(summaryCSV, summaryFilename)

      // Export question details
      const questionCSV = this.exportQuestionAnalysisToCSV(results.questionAnalysis)
      const questionFilename = `sat-results-questions-${attemptId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`
      this.downloadCSV(questionCSV, questionFilename)

    } catch (error) {
      console.error('Export failed:', error)
      throw new Error('Failed to export results')
    }
  }

  // Generate simple PDF-like text report
  static generateTextReport(results: ComprehensiveResults): string {
    const { attempt, detailedScore, questionAnalysis, performanceAnalytics } = results
    
    const report = `
SAT PRACTICE TEST RESULTS REPORT
===============================

Test Information:
- Attempt ID: ${attempt.id}
- Completed: ${attempt.completed_at ? new Date(attempt.completed_at).toLocaleString() : 'In Progress'}
- Total Time: ${Math.round(performanceAnalytics.totalTimeSpent / 60)} minutes

SCORE BREAKDOWN:
===============
Total Score: ${detailedScore.totalScore} / 1600
Evidence-Based Reading & Writing: ${detailedScore.evidenceBasedReading} / 800
Math: ${detailedScore.mathScore} / 800

MODULE PERFORMANCE:
==================
English 1 (Reading): ${detailedScore.rawScores.english1} correct (${Math.round(detailedScore.percentages.english1)}%)
English 2 (Writing): ${detailedScore.rawScores.english2} correct (${Math.round(detailedScore.percentages.english2)}%)
Math 1 (No Calculator): ${detailedScore.rawScores.math1} correct (${Math.round(detailedScore.percentages.math1)}%)
Math 2 (Calculator): ${detailedScore.rawScores.math2} correct (${Math.round(detailedScore.percentages.math2)}%)

DIFFICULTY ANALYSIS:
===================
Easy Questions: ${performanceAnalytics.difficultyBreakdown.easy.correct}/${performanceAnalytics.difficultyBreakdown.easy.attempted} (${Math.round(performanceAnalytics.difficultyBreakdown.easy.percentage)}%)
Medium Questions: ${performanceAnalytics.difficultyBreakdown.medium.correct}/${performanceAnalytics.difficultyBreakdown.medium.attempted} (${Math.round(performanceAnalytics.difficultyBreakdown.medium.percentage)}%)
Hard Questions: ${performanceAnalytics.difficultyBreakdown.hard.correct}/${performanceAnalytics.difficultyBreakdown.hard.attempted} (${Math.round(performanceAnalytics.difficultyBreakdown.hard.percentage)}%)

STRENGTHS:
==========
${performanceAnalytics.strengthAreas.length > 0 ? performanceAnalytics.strengthAreas.join(', ') : 'Continue practicing to identify strength areas'}

AREAS FOR IMPROVEMENT:
=====================
${performanceAnalytics.weaknessAreas.length > 0 ? performanceAnalytics.weaknessAreas.join(', ') : 'Great job! Keep up the excellent work'}

TOP TOPIC PERFORMANCE:
=====================
${performanceAnalytics.topicPerformance.slice(0, 5).map(topic => 
  `${topic.topic}: ${topic.correct}/${topic.attempted} (${Math.round(topic.percentage)}%)`
).join('\n')}

=================================
Report generated: ${new Date().toLocaleString()}
    `.trim()

    return report
  }

  // Download text report
  static downloadTextReport(results: ComprehensiveResults): void {
    const report = this.generateTextReport(results)
    const filename = `sat-report-${results.attempt.id.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.txt`
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' })
    const link = document.createElement('a')
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  // Helper function to calculate test duration
  private static calculateDuration(startTime: string | null, endTime: string | null): string {
    if (!startTime || !endTime) return 'N/A'
    
    const start = new Date(startTime)
    const end = new Date(endTime)
    const durationMs = end.getTime() - start.getTime()
    const durationMinutes = Math.round(durationMs / (1000 * 60))
    
    return `${durationMinutes} min`
  }
}