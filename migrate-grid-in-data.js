const { createClient } = require('@supabase/supabase-js')

// Use service role key to bypass RLS for migration
const supabaseUrl = 'https://eoyzqdsxlweygsukjnef.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI4NDI4MSwiZXhwIjoyMDY3ODYwMjgxfQ.A_K81bklI-TkCrhWzElzDH86wrIveEQ1-hzDwM8ByNQ'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
})

async function migrateGridInQuestions() {
  console.log('🚀 Starting grid_in questions migration...')
  
  try {
    // First, apply the database schema changes
    console.log('📋 Applying database schema...')
    const { error: schemaError } = await supabase
      .rpc('migrate_grid_in_answers')
    
    if (schemaError) {
      console.error('❌ Schema migration error:', schemaError)
      return
    }
    
    console.log('✅ Schema migration completed successfully')
    
    // Get all grid_in questions that need migration
    console.log('🔍 Finding grid_in questions that need migration...')
    const { data: questions, error: fetchError } = await supabase
      .from('questions')
      .select('id, correct_answer, correct_answers, question_text')
      .eq('question_type', 'grid_in')
      .is('correct_answers', null)
    
    if (fetchError) {
      console.error('❌ Error fetching questions:', fetchError)
      return
    }
    
    console.log(`📊 Found ${questions?.length || 0} grid_in questions to migrate`)
    
    if (!questions || questions.length === 0) {
      console.log('✅ No questions need migration')
      return
    }
    
    // Migrate each question
    let successCount = 0
    let errorCount = 0
    
    for (const question of questions) {
      try {
        console.log(`🔄 Migrating question ${question.id}: "${question.question_text.substring(0, 50)}..."`)
        
        // Convert single correct_answer to array
        const correctAnswers = question.correct_answer ? [question.correct_answer] : ['']
        
        const { error: updateError } = await supabase
          .from('questions')
          .update({
            correct_answers: correctAnswers
          })
          .eq('id', question.id)
        
        if (updateError) {
          console.error(`❌ Error updating question ${question.id}:`, updateError)
          errorCount++
        } else {
          console.log(`✅ Successfully migrated question ${question.id}`)
          successCount++
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`❌ Unexpected error migrating question ${question.id}:`, error)
        errorCount++
      }
    }
    
    console.log('\n📊 Migration Summary:')
    console.log(`✅ Successfully migrated: ${successCount} questions`)
    console.log(`❌ Failed to migrate: ${errorCount} questions`)
    console.log(`📈 Total processed: ${successCount + errorCount} questions`)
    
    if (errorCount === 0) {
      console.log('\n🎉 All grid_in questions migrated successfully!')
    } else {
      console.log('\n⚠️ Some questions failed to migrate. Please check the errors above.')
    }
    
  } catch (error) {
    console.error('💥 Fatal migration error:', error)
  }
}

// Run the migration
if (require.main === module) {
  migrateGridInQuestions()
    .then(() => {
      console.log('\n🏁 Migration script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Migration script failed:', error)
      process.exit(1)
    })
}

module.exports = { migrateGridInQuestions }