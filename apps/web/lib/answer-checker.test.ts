import { describe, it, expect } from 'vitest'
import {
  checkAnswer,
  normalizeCorrectAnswers,
  hasMultipleCorrectAnswers,
} from './answer-checker'

describe('checkAnswer', () => {
  it('should correctly validate single correct answer strings', () => {
    expect(checkAnswer('A', 'A')).toBe(true)
    expect(checkAnswer('a', 'A')).toBe(true)
    expect(checkAnswer(' A ', 'A')).toBe(true)
    expect(checkAnswer('B', 'A')).toBe(false)
    expect(checkAnswer('', 'A')).toBe(false)
  })

  it('should handle case insensitivity and whitespace', () => {
    expect(checkAnswer('hello', 'HELLO')).toBe(true)
    expect(checkAnswer(' hello ', '  HELLO  ')).toBe(true)
    expect(checkAnswer('hello world', 'Hello World')).toBe(true)
  })

  it('should correctly validate against array of correct answers', () => {
    const correctAnswers = ['192', '192.0', '192.00']
    expect(checkAnswer('192', correctAnswers)).toBe(true)
    expect(checkAnswer('192.0', correctAnswers)).toBe(true)
    expect(checkAnswer(' 192.00 ', correctAnswers)).toBe(true)
    expect(checkAnswer('193', correctAnswers)).toBe(false)
    expect(checkAnswer('', correctAnswers)).toBe(false)
  })

  it('should handle mixed case in arrays', () => {
    const correctAnswers = ['Yes', 'TRUE', 'correct']
    expect(checkAnswer('yes', correctAnswers)).toBe(true)
    expect(checkAnswer('true', correctAnswers)).toBe(true)
    expect(checkAnswer('CORRECT', correctAnswers)).toBe(true)
    expect(checkAnswer('no', correctAnswers)).toBe(false)
  })
})

describe('normalizeCorrectAnswers', () => {
  it('should handle string inputs', () => {
    expect(normalizeCorrectAnswers('A')).toEqual(['A'])
    expect(normalizeCorrectAnswers('hello')).toEqual(['hello'])
  })

  it('should handle JSON string arrays', () => {
    expect(normalizeCorrectAnswers('["A", "B"]')).toEqual(['A', 'B'])
    expect(normalizeCorrectAnswers('["192", "192.0"]')).toEqual([
      '192',
      '192.0',
    ])
  })

  it('should handle regular arrays', () => {
    expect(normalizeCorrectAnswers(['A', 'B'])).toEqual(['A', 'B'])
    expect(normalizeCorrectAnswers(['192'])).toEqual(['192'])
  })

  it('should handle double-encoded JSON arrays', () => {
    expect(normalizeCorrectAnswers(['["8"]'])).toEqual(['8'])
    expect(normalizeCorrectAnswers(['["A", "B"]'])).toEqual(['A', 'B'])
  })

  it('should filter out non-string values', () => {
    expect(normalizeCorrectAnswers([42, 'A', null, 'B'])).toEqual(['A', 'B'])
  })

  it('should handle malformed JSON gracefully', () => {
    expect(normalizeCorrectAnswers('invalid json')).toEqual(['invalid json'])
    expect(normalizeCorrectAnswers(['invalid json'])).toEqual(['invalid json'])
  })

  it('should handle null and undefined', () => {
    expect(normalizeCorrectAnswers(null)).toEqual([])
    expect(normalizeCorrectAnswers(undefined)).toEqual([])
  })
})

describe('hasMultipleCorrectAnswers', () => {
  it('should return false for single correct answers', () => {
    expect(hasMultipleCorrectAnswers('A')).toBe(false)
    expect(hasMultipleCorrectAnswers(['A'])).toBe(false)
  })

  it('should return true for multiple correct answers', () => {
    expect(hasMultipleCorrectAnswers(['A', 'B'])).toBe(true)
    expect(hasMultipleCorrectAnswers('["A", "B"]')).toBe(true)
  })

  it('should handle empty arrays', () => {
    expect(hasMultipleCorrectAnswers([])).toBe(false)
    expect(hasMultipleCorrectAnswers(null)).toBe(false)
  })
})
