'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface ScoringCurve {
  id: number
  curve_name: string
  curve_data: Array<{
    raw: number
    lower: number
    upper: number
  }>
}

interface ExamConfig {
  id: string
  title: string
  english_scoring_curve_id: number | null
  math_scoring_curve_id: number | null
}

export function ScoringDebug() {
  const [curves, setCurves] = useState<ScoringCurve[]>([])
  const [exams, setExams] = useState<ExamConfig[]>([])
  const [recentAttempt, setRecentAttempt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDebugData()
  }, [])

  const loadDebugData = async () => {
    try {
      // Load scoring curves
      const { data: curvesData, error: curvesError } = await supabase
        .from('scoring_curves')
        .select('*')

      if (curvesError) throw curvesError

      // Load exams with scoring curve assignments
      const { data: examsData, error: examsError } = await supabase
        .from('exams')
        .select('id, title, english_scoring_curve_id, math_scoring_curve_id')

      if (examsError) throw examsError

      // Load most recent completed attempt to see scoring details
      const { data: attemptData, error: attemptError } = await supabase
        .from('test_attempts')
        .select(
          `
          *,
          user_answers (
            *,
            questions (module_type, points)
          )
        `
        )
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      setCurves(curvesData || [])
      setExams(examsData || [])
      if (attemptData) {
        setRecentAttempt(attemptData)
      }
    } catch (error) {
      console.error('Debug data load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const analyzeRawScores = (attempt: any) => {
    if (!attempt?.user_answers) return { english: 0, math: 0, total: 0 }

    let englishCorrect = 0
    let mathCorrect = 0
    let totalQuestions = 0

    attempt.user_answers.forEach((answer: any) => {
      totalQuestions++
      if (answer.is_correct && answer.questions) {
        const moduleType = answer.questions.module_type
        if (moduleType.startsWith('english')) {
          englishCorrect++
        } else if (moduleType.startsWith('math')) {
          mathCorrect++
        }
      }
    })

    return {
      english: englishCorrect,
      math: mathCorrect,
      total: totalQuestions,
      englishTotal: attempt.user_answers.filter((a: any) =>
        a.questions?.module_type.startsWith('english')
      ).length,
      mathTotal: attempt.user_answers.filter((a: any) =>
        a.questions?.module_type.startsWith('math')
      ).length,
    }
  }

  if (loading) {
    return <div className="p-4 bg-gray-100 rounded">Loading debug data...</div>
  }

  const scores = recentAttempt ? analyzeRawScores(recentAttempt) : null

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Scoring System Debug
      </h3>

      {/* Scoring Curves */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">
          Available Scoring Curves
        </h4>
        <div className="space-y-2">
          {curves.map((curve) => (
            <div key={curve.id} className="text-sm bg-gray-50 p-3 rounded">
              <div className="font-medium">
                #{curve.id}: {curve.curve_name}
              </div>
              <div className="text-gray-600">
                Raw score range:{' '}
                {Math.min(...curve.curve_data.map((d) => d.raw))} -{' '}
                {Math.max(...curve.curve_data.map((d) => d.raw))}
              </div>
              <div className="text-gray-600">
                Scaled range:{' '}
                {Math.min(...curve.curve_data.map((d) => d.lower))} -{' '}
                {Math.max(...curve.curve_data.map((d) => d.upper))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exam Configuration */}
      <div>
        <h4 className="font-medium text-gray-800 mb-3">
          Exam Scoring Configuration
        </h4>
        <div className="space-y-2">
          {exams.map((exam) => (
            <div key={exam.id} className="text-sm bg-gray-50 p-3 rounded">
              <div className="font-medium">{exam.title}</div>
              <div className="text-gray-600">
                English Curve: {exam.english_scoring_curve_id || 'Not assigned'}
              </div>
              <div className="text-gray-600">
                Math Curve: {exam.math_scoring_curve_id || 'Not assigned'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Attempt Analysis */}
      {recentAttempt && scores && (
        <div>
          <h4 className="font-medium text-gray-800 mb-3">
            Most Recent Attempt Analysis
          </h4>
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
            <div className="text-sm space-y-2">
              <div>
                <strong>Attempt ID:</strong> {recentAttempt.id}
              </div>
              <div>
                <strong>Final Scores:</strong>{' '}
                {JSON.stringify(recentAttempt.final_scores)}
              </div>
              <div>
                <strong>Raw Scores:</strong>
              </div>
              <ul className="ml-4 space-y-1">
                <li>
                  English: {scores.english}/{scores.englishTotal} correct
                </li>
                <li>
                  Math: {scores.math}/{scores.mathTotal} correct (틀린 개수:{' '}
                  {scores.mathTotal - scores.math})
                </li>
                <li>Total Questions: {scores.total}</li>
              </ul>

              {/* Show curve mapping for current scores */}
              <div className="mt-4">
                <strong>Expected Scaled Scores:</strong>
                {curves.map((curve) => {
                  const englishPoint = curve.curve_data.find(
                    (d) => d.raw === scores.english
                  )
                  const mathPoint = curve.curve_data.find(
                    (d) => d.raw === scores.math
                  )

                  if (englishPoint || mathPoint) {
                    return (
                      <div key={curve.id} className="ml-4 text-xs">
                        <div>{curve.curve_name}:</div>
                        {englishPoint && (
                          <div>
                            - English raw {scores.english} →{' '}
                            {Math.round(
                              (englishPoint.lower + englishPoint.upper) / 2
                            )}
                          </div>
                        )}
                        {mathPoint && (
                          <div>
                            - Math raw {scores.math} →{' '}
                            {Math.round(
                              (mathPoint.lower + mathPoint.upper) / 2
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }
                  return null
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
