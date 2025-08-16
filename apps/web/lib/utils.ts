import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeAgo(date: string): string {
  const now = new Date()
  const past = new Date(date)
  const diffMs = now.getTime() - past.getTime()

  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ${diffMinutes % 60}m ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks > 1 ? 's' : ''} ago`
  return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
}

export function parseTableFromMarkdown(
  text: string
): { headers: string[]; rows: string[][] } | null {
  if (!text) return null
  const tableMatch = text.match(/{{table}}([\s\S]*?){{\/table}}/)
  if (!tableMatch) return null

  const content = tableMatch[1].trim()
  const lines = content.split('\n').filter((line) => line.trim())
  if (lines.length < 3) return null

  const headers = lines[0].split('|').map((h) => h.trim())
  const rows = lines
    .slice(2)
    .map((line) => line.split('|').map((cell) => cell.trim()))
  return { headers, rows }
}

export function buildTableMarkdown(tableData: {
  headers: string[]
  rows: string[][]
}): string {
  let markdown = '{{table}}\n'
  markdown += `${tableData.headers.join(' | ')}\n`
  markdown += `${tableData.headers.map(() => '---').join(' | ')}\n`
  tableData.rows.forEach((row) => {
    markdown += `${row.join(' | ')}\n`
  })
  markdown += '{{\/table}}'
  return markdown
}
