import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    timeout: 60000,
    testTimeout: 60000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eoyzqdsxlweygsukjnef.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVveXpxZHN4bHdleWdzdWtqbmVmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjI4NDI4MSwiZXhwIjoyMDY3ODYwMjgxfQ.A_K81bklI-TkCrhWzElzDH86wrIveEQ1-hzDwM8ByNQ'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), '.'),
      '~/': path.resolve(process.cwd(), './'),
    },
  },
})