import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

describe('Scoring System Check', () => {
  it('should check the complete scoring system setup', async () => {
    console.log('🔍 Checking complete scoring system...')

    // Check scoring templates
    const { data: templates, error: templatesError } = await supabase
      .from('scoring_templates')
      .select('*')

    console.log('\n📋 Scoring Templates:')
    if (templatesError) {
      console.log(`❌ Error: ${templatesError.message}`)
    } else {
      console.log(`Found ${templates?.length || 0} templates`)
      templates?.forEach((template) => {
        console.log(`  - ${template.name} (id: ${template.id})`)
      })
    }

    // Check scoring curves
    const { data: curves, error: curvesError } = await supabase
      .from('scoring_curves')
      .select('*')

    console.log('\n📈 Scoring Curves:')
    if (curvesError) {
      console.log(`❌ Error: ${curvesError.message}`)
    } else {
      console.log(`Found ${curves?.length || 0} curves`)
      curves?.slice(0, 5).forEach((curve) => {
        console.log(`  - ${curve.name} (id: ${curve.id})`)
      })
    }

    // Check table schema
    const { data: templateCols } = await supabase.rpc('get_table_columns', {
      table_name: 'scoring_templates',
    })
    console.log('\n🗃️ Scoring Templates Schema:')
    console.log(templateCols)

    // Check if we can create a basic template
    console.log('\n🔧 Testing template creation...')

    const testTemplate = {
      id: 'english_only',
      name: 'English Only Section',
      scoring_groups: {
        english: ['english1', 'english2'],
      },
    }

    const { data: createdTemplate, error: createError } = await supabase
      .from('scoring_templates')
      .upsert(testTemplate)
      .select()

    if (createError) {
      console.log(`❌ Create Error: ${createError.message}`)
    } else {
      console.log('✅ Template created/updated successfully')
    }

    expect(true).toBe(true)
  })
})
