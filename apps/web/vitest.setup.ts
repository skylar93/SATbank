import '@testing-library/jest-dom'
import { config } from 'dotenv'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Set fallback values for tests if needed
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://eoyzqdsxlweygsukjnef.supabase.co'
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI4NDI4MSwiZXhwIjoyMDY3ODYwMjgxfQ.A_K81bklI-TkCrhWzElzDH86wrIveEQ1-hzDwM8ByNQ'
}
