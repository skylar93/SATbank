import { describe, it, expect } from 'vitest'
import { validateAnswer } from './answer-validation'

describe('validateAnswer', () => {
  it('should handle exact matches', () => {
    const result = validateAnswer('A', 'A')
    expect(result.isCorrect).toBe(true)
    expect(result.normalizedAnswer).toBe('a')
    expect(result.originalAnswer).toBe('A')
  })

  it('should handle case insensitivity and whitespace', () => {
    expect(validateAnswer(' A ', 'a').isCorrect).toBe(true)
    expect(validateAnswer('Hello World', 'hello world').isCorrect).toBe(true)
    expect(validateAnswer('  TEST  ', 'test').isCorrect).toBe(true)
  })

  it('should handle decimal equivalents', () => {
    expect(validateAnswer('0.5', '1/2').isCorrect).toBe(true)
    expect(validateAnswer('0.25', '1/4').isCorrect).toBe(true)
    expect(validateAnswer('2.5', '5/2').isCorrect).toBe(true)
  })

  it('should handle fraction equivalents', () => {
    expect(validateAnswer('1/2', '0.5').isCorrect).toBe(true)
    expect(validateAnswer('3/4', '0.75').isCorrect).toBe(true)
    expect(validateAnswer('2/3', '0.6667').isCorrect).toBe(true)
  })

  it('should handle decimal precision differences', () => {
    expect(validateAnswer('0.33', '1/3').isCorrect).toBe(false) // Outside tolerance
    expect(validateAnswer('0.333', '1/3').isCorrect).toBe(true) // Within tolerance
    expect(validateAnswer('3.14', '3.14159').isCorrect).toBe(false) // Outside tolerance
    expect(validateAnswer('3.142', '3.14159').isCorrect).toBe(true) // Within tolerance
  })

  it('should handle integer answers', () => {
    expect(validateAnswer('5', '5').isCorrect).toBe(true)
    expect(validateAnswer('5.0', '5').isCorrect).toBe(true)
    expect(validateAnswer('5', '5.00').isCorrect).toBe(true)
  })

  it('should handle negative numbers', () => {
    expect(validateAnswer('-5', '-5').isCorrect).toBe(true)
    expect(validateAnswer('-0.5', '-1/2').isCorrect).toBe(true)
    expect(validateAnswer('-1/3', '-0.333').isCorrect).toBe(true)
  })

  it('should reject incorrect answers', () => {
    expect(validateAnswer('A', 'B').isCorrect).toBe(false)
    expect(validateAnswer('5', '6').isCorrect).toBe(false)
    expect(validateAnswer('0.5', '0.6').isCorrect).toBe(false)
    expect(validateAnswer('1/2', '1/3').isCorrect).toBe(false)
  })

  it('should handle complex fractions', () => {
    expect(validateAnswer('22/7', '3.142857').isCorrect).toBe(true)
    expect(validateAnswer('355/113', '3.1415929').isCorrect).toBe(true)
  })

  it('should handle edge cases', () => {
    expect(validateAnswer('0', '0').isCorrect).toBe(true)
    expect(validateAnswer('0.0', '0').isCorrect).toBe(true)
    expect(validateAnswer('1/1', '1').isCorrect).toBe(true)
  })
})
