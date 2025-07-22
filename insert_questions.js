const { createClient } = require('@supabase/supabase-js')

// Use service role key to bypass RLS for seeding
const supabaseUrl = 'https://eoyzqdsxlweygsukjnef.supabase.co'
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI4NDI4MSwiZXhwIjoyMDY3ODYwMjgxfQ.A_K81bklI-TkCrhWzElzDH86wrIveEQ1-hzDwM8ByNQ'

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
})

const questions = [
  {
    module_type: 'english1',
    question_number: 1,
    question_type: 'multiple_choice',
    difficulty_level: 'medium',
    question_text: 'The following text is adapted from Charlotte Perkins Gilman\'s 1892 short story "The Yellow Wallpaper."\n\nIt is very seldom that mere ordinary people like John and myself secure ancestral halls for the summer. A colonial mansion, a hereditary estate, I would say a haunted house, and reach the height of romantic felicity—but that would be asking too much of fate! Still I will proudly declare that there is something queer about it. Else, why should it be let so cheaply? And why have stood so long untenanted?\n\nWhich choice best describes the function of the underlined sentence in the text as a whole?',
    options: {
      "A": "It reveals the narrator's dissatisfaction with the mansion's affordability.",
      "B": "It suggests that the narrator suspects there may be something unusual about the mansion.",
      "C": "It demonstrates the narrator's extensive knowledge of real estate markets.",
      "D": "It indicates the narrator's preference for modern housing over historic properties."
    },
    correct_answer: 'B',
    explanation: 'The narrator is questioning why the mansion is cheap and has been unoccupied, suggesting suspicion about something being wrong with it.',
    topic_tags: ['reading comprehension', 'function questions', 'textual analysis']
  },
  {
    module_type: 'english1',
    question_number: 2,
    question_type: 'multiple_choice',
    difficulty_level: 'easy',
    question_text: 'While researching a topic, a student has taken the following notes:\n\n• Marie Curie was born in Poland in 1867\n• She moved to Paris in 1891 to study at the Sorbonne\n• She discovered the elements polonium (1898) and radium (1902)\n• She was the first woman to win a Nobel Prize (Physics, 1903)\n• She won a second Nobel Prize in Chemistry in 1911\n• She remains the only person to win Nobel Prizes in two different sciences\n\nThe student wants to emphasize Marie Curie\'s unique achievement in Nobel Prize history. Which choice most effectively uses relevant information from the notes to accomplish this goal?',
    options: {
      "A": "Marie Curie, who was born in Poland in 1867, moved to Paris to study at the Sorbonne in 1891.",
      "B": "Marie Curie discovered two elements: polonium in 1898 and radium in 1902.",
      "C": "Marie Curie was the first woman to win a Nobel Prize when she won in Physics in 1903.",
      "D": "Marie Curie remains the only person to win Nobel Prizes in two different sciences, Physics and Chemistry."
    },
    correct_answer: 'D',
    explanation: 'Choice D directly states her unique achievement of being the only person to win Nobel Prizes in two different sciences.',
    topic_tags: ['research skills', 'synthesis', 'effective writing']
  },
  {
    module_type: 'english2',
    question_number: 1,
    question_type: 'multiple_choice',
    difficulty_level: 'medium',
    question_text: 'Urban planners in Copenhagen have implemented a comprehensive cycling infrastructure that has transformed the city\'s transportation landscape. _______ over 40% of residents now commute to work by bicycle, making it one of the most bike-friendly cities in the world.',
    options: {
      "A": "Specifically,",
      "B": "As a result,",
      "C": "For example,",
      "D": "In contrast,"
    },
    correct_answer: 'B',
    explanation: 'The cycling infrastructure implementation caused the result of 40% bicycle commuting.',
    topic_tags: ['transitions', 'cause and effect', 'urban planning']
  },
  {
    module_type: 'english2',
    question_number: 2,
    question_type: 'multiple_choice',
    difficulty_level: 'easy',
    question_text: 'The research team\'s findings _______ that renewable energy sources could meet 85% of the country\'s power needs by 2035.',
    options: {
      "A": "suggests",
      "B": "suggest",
      "C": "suggesting",
      "D": "to suggest"
    },
    correct_answer: 'B',
    explanation: 'The plural subject "findings" requires the plural verb "suggest."',
    topic_tags: ['subject-verb agreement', 'grammar', 'verb forms']
  },
  {
    module_type: 'math1',
    question_number: 1,
    question_type: 'multiple_choice',
    difficulty_level: 'medium',
    question_text: 'If 3x + 7 = 22, what is the value of 6x + 14?',
    options: {
      "A": "30",
      "B": "44",
      "C": "15",
      "D": "22"
    },
    correct_answer: 'B',
    explanation: 'Solve 3x + 7 = 22 to get 3x = 15, so x = 5. Then 6x + 14 = 6(5) + 14 = 30 + 14 = 44. Alternatively, notice that 6x + 14 = 2(3x + 7) = 2(22) = 44.',
    topic_tags: ['linear equations', 'algebraic manipulation']
  },
  {
    module_type: 'math1',
    question_number: 2,
    question_type: 'grid_in',
    difficulty_level: 'medium',
    question_text: 'What value of x satisfies the equation 2x + 3 = 3x - 5?',
    options: null,
    correct_answer: '8',
    explanation: 'Solve: 2x + 3 = 3x - 5. Subtract 2x from both sides: 3 = x - 5. Add 5 to both sides: x = 8.',
    topic_tags: ['linear equations', 'solving for variables']
  },
  {
    module_type: 'math2',
    question_number: 1,
    question_type: 'multiple_choice',
    difficulty_level: 'medium',
    question_text: 'A survey of 500 students found that 60% play sports, 40% play music, and 25% play both sports and music. How many students play either sports or music (or both)?',
    options: {
      "A": "375",
      "B": "350",
      "C": "300",
      "D": "425"
    },
    correct_answer: 'A',
    explanation: 'Using the inclusion-exclusion principle: Sports OR Music = Sports + Music - Both = (60% × 500) + (40% × 500) - (25% × 500) = 300 + 200 - 125 = 375.',
    topic_tags: ['probability', 'set theory', 'data analysis']
  },
  {
    module_type: 'math2',
    question_number: 2,
    question_type: 'grid_in',
    difficulty_level: 'hard',
    question_text: 'In a right triangle, one leg has length 5 and the hypotenuse has length 13. What is the length of the other leg?',
    options: null,
    correct_answer: '12',
    explanation: 'Using the Pythagorean theorem: a² + b² = c². So 5² + b² = 13², which gives 25 + b² = 169, so b² = 144, and b = 12.',
    topic_tags: ['geometry', 'Pythagorean theorem', 'right triangles']
  }
]

async function insertQuestions() {
  console.log('📝 Inserting sample questions using service role...')
  
  try {
    // First check if questions already exist
    const { count } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
    
    console.log(`📊 Current questions count: ${count}`)
    
    if (count > 0) {
      console.log('✅ Questions already exist, skipping insertion')
      return
    }
    
    const { data, error } = await supabase
      .from('questions')
      .insert(questions)
      .select()
    
    if (error) {
      console.error('❌ Error inserting questions:', error)
    } else {
      console.log(`✅ Successfully inserted ${data.length} questions`)
      console.log('📋 Questions inserted:')
      data.forEach(q => console.log(`  - ${q.module_type} #${q.question_number}: ${q.question_text.substring(0, 50)}...`))
    }
  } catch (err) {
    console.error('❌ Failed to insert questions:', err)
  }
}

insertQuestions()