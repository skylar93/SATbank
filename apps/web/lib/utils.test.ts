import { describe, it, expect } from 'vitest'
import {
  cn,
  formatTimeAgo,
  parseTableFromMarkdown,
  buildTableMarkdown,
  formatDuration,
} from './utils'

describe('cn (className utility)', () => {
  it('should merge class names correctly', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2')
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500') // Tailwind merge should prioritize last
  })

  it('should handle conditional classes', () => {
    expect(cn('base', true && 'conditional', false && 'hidden')).toBe(
      'base conditional'
    )
  })
})

describe('formatTimeAgo', () => {
  it('should format recent times correctly', () => {
    const now = new Date()
    const justNow = new Date(now.getTime() - 30000) // 30 seconds ago
    expect(formatTimeAgo(justNow.toISOString())).toBe('Just now')
  })

  it('should format minutes correctly', () => {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    expect(formatTimeAgo(fiveMinutesAgo.toISOString())).toBe('5m ago')
  })

  it('should format hours correctly', () => {
    const now = new Date()
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    expect(formatTimeAgo(twoHoursAgo.toISOString())).toBe('2h 0m ago')
  })

  it('should format days correctly', () => {
    const now = new Date()
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    expect(formatTimeAgo(threeDaysAgo.toISOString())).toBe('3 days ago')
  })
})

describe('parseTableFromMarkdown', () => {
  it('should parse valid table markdown', () => {
    const markdown = `{{table}}
Name | Age | City
--- | --- | ---
John | 25 | NYC
Jane | 30 | LA
{{/table}}`

    const result = parseTableFromMarkdown(markdown)
    expect(result).toEqual({
      headers: ['Name', 'Age', 'City'],
      rows: [
        ['John', '25', 'NYC'],
        ['Jane', '30', 'LA'],
      ],
    })
  })

  it('should return null for invalid markdown', () => {
    expect(parseTableFromMarkdown('')).toBe(null)
    expect(parseTableFromMarkdown('No table here')).toBe(null)
    expect(parseTableFromMarkdown('{{table}}Invalid{{/table}}')).toBe(null)
  })

  it('should handle tables with different column counts', () => {
    const markdown = `{{table}}
A | B
--- | ---
1 | 2 | 3
{{/table}}`

    const result = parseTableFromMarkdown(markdown)
    expect(result?.headers).toEqual(['A', 'B'])
    expect(result?.rows).toEqual([['1', '2', '3']])
  })
})

describe('buildTableMarkdown', () => {
  it('should build correct table markdown', () => {
    const tableData = {
      headers: ['Name', 'Age'],
      rows: [
        ['John', '25'],
        ['Jane', '30'],
      ],
    }

    const result = buildTableMarkdown(tableData)
    expect(result).toContain('{{table}}')
    expect(result).toContain('Name | Age')
    expect(result).toContain('--- | ---')
    expect(result).toContain('John | 25')
    expect(result).toContain('Jane | 30')
    expect(result).toContain('{{/table}}')
  })

  it('should handle empty tables', () => {
    const tableData = { headers: [], rows: [] }
    const result = buildTableMarkdown(tableData)
    expect(result).toContain('{{table}}')
    expect(result).toContain('{{/table}}')
  })
})

describe('formatDuration', () => {
  it('should format seconds correctly', () => {
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(59)).toBe('59s')
  })

  it('should format minutes correctly', () => {
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(90)).toBe('1m 30s')
    expect(formatDuration(120)).toBe('2m')
  })

  it('should format hours correctly', () => {
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(3660)).toBe('1h 1m')
    expect(formatDuration(7200)).toBe('2h')
  })

  it('should format days correctly', () => {
    expect(formatDuration(86400)).toBe('1d')
    expect(formatDuration(86400 + 3600)).toBe('1d 1h')
    expect(formatDuration(172800)).toBe('2d')
  })

  it('should handle edge cases', () => {
    expect(formatDuration(0)).toBe('0s')
    expect(formatDuration(1)).toBe('1s')
  })
})
