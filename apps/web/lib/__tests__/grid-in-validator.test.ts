/**
 * Tests for Grid-In Answer Validation
 */

import {
  validateGridInAnswer,
  parseCorrectAnswers,
  formatCorrectAnswersDisplay,
} from '../grid-in-validator'

describe('Grid-In Validator', () => {
  describe('parseCorrectAnswers', () => {
    it('should parse string array correctly', () => {
      const question = { correct_answers: ['3/4', '0.75'] }
      const result = parseCorrectAnswers(question)
      expect(result).toEqual(['3/4', '0.75'])
    })

    it('should parse JSON string array', () => {
      const question = { correct_answers: '["3/4", "0.75"]' }
      const result = parseCorrectAnswers(question)
      expect(result).toEqual(['3/4', '0.75'])
    })

    it('should handle nested JSON strings in array', () => {
      const question = { correct_answers: ['["3/4", "0.75"]'] }
      const result = parseCorrectAnswers(question)
      expect(result).toEqual(['3/4', '0.75'])
    })

    it('should fallback to correct_answer when correct_answers is null', () => {
      const question = { correct_answer: '0.75', correct_answers: null }
      const result = parseCorrectAnswers(question)
      expect(result).toEqual(['0.75'])
    })
  })

  describe('validateGridInAnswer', () => {
    it('should validate equivalent fraction and decimal', () => {
      const question = { correct_answers: ['3/4', '0.75'] }

      const result1 = validateGridInAnswer(question, '3/4')
      expect(result1.isCorrect).toBe(true)

      const result2 = validateGridInAnswer(question, '0.75')
      expect(result2.isCorrect).toBe(true)

      const result3 = validateGridInAnswer(question, '6/8')
      expect(result3.isCorrect).toBe(true)
    })

    it('should handle integer answers', () => {
      const question = { correct_answers: ['18', '18.0'] }

      const result1 = validateGridInAnswer(question, '18')
      expect(result1.isCorrect).toBe(true)

      const result2 = validateGridInAnswer(question, '18.0')
      expect(result2.isCorrect).toBe(true)
    })

    it('should reject incorrect answers', () => {
      const question = { correct_answers: ['3/4', '0.75'] }

      const result = validateGridInAnswer(question, '1/2')
      expect(result.isCorrect).toBe(false)
    })

    it('should handle non-numeric answers', () => {
      const question = { correct_answers: ['ABC', 'abc'] }

      const result1 = validateGridInAnswer(question, 'ABC')
      expect(result1.isCorrect).toBe(true)

      const result2 = validateGridInAnswer(question, 'abc')
      expect(result2.isCorrect).toBe(true)
    })
  })

  describe('formatCorrectAnswersDisplay', () => {
    it('should format equivalent answers correctly', () => {
      const answers = ['3/4', '0.75', '6/8']
      const result = formatCorrectAnswersDisplay(answers)
      expect(result).toBe('3/4 or 0.75 or 6/8')
    })

    it('should separate different answer groups', () => {
      const answers = ['3/4', '0.75', '1/2', '0.5']
      const result = formatCorrectAnswersDisplay(answers)
      expect(result).toContain('3/4 or 0.75')
      expect(result).toContain('1/2 or 0.5')
    })
  })
})
