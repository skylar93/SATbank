import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Database Schema Check', () => {
  it('should check what scoring-related tables exist', async () => {
    console.log('🔍 Checking database schema...')

    // Get all tables
    const { data: tables } = await supabase.rpc('get_all_tables')
    console.log('\n📋 All Tables:')
    if (tables) {
      tables.forEach((table: any) => console.log(`  - ${table.table_name}`))
    }

    // Check specific scoring-related tables
    const scoringTables = ['scoring_templates', 'scoring_curves', 'exams', 'test_attempts']

    console.log('\n🎯 Scoring System Tables:')
    for (const tableName of scoringTables) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (error) {
        console.log(`❌ ${tableName}: ${error.message}`)
      } else {
        console.log(`✅ ${tableName}: exists`)
      }
    }

    // Check exam structure
    const { data: sampleExam } = await supabase
      .from('exams')
      .select('*')
      .limit(1)
      .single()

    console.log('\n📄 Sample Exam Structure:')
    if (sampleExam) {
      console.log(`  ID: ${sampleExam.id}`)
      console.log(`  Title: ${sampleExam.title}`)
      console.log(`  Template ID: ${sampleExam.template_id}`)
      console.log(`  Created: ${sampleExam.created_at}`)
      console.log(`  Columns: ${Object.keys(sampleExam).join(', ')}`)
    }

    // Check scoring curves structure
    const { data: curves } = await supabase
      .from('scoring_curves')
      .select('*')
      .limit(2)

    console.log('\n📈 Scoring Curves Structure:')
    curves?.forEach(curve => {
      console.log(`  Curve ID ${curve.id}:`)
      console.log(`    Name: ${curve.name}`)
      console.log(`    Columns: ${Object.keys(curve).join(', ')}`)
    })

    expect(true).toBe(true)
  })
})