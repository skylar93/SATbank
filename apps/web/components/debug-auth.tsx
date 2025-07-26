'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/auth-context'

export function DebugAuth() {
  const [debugOutput, setDebugOutput] = useState<string>('')
  const [isDebugging, setIsDebugging] = useState(false)
  const { user, isAdmin } = useAuth()

  const debugAuth = async () => {
    setIsDebugging(true)
    let output = '🔍 Starting authentication debug...\n\n'
    
    try {
      // Check current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      output += `📋 Session check:\n`
      output += `  hasSession: ${!!session}\n`
      output += `  userId: ${session?.user?.id}\n`
      output += `  userEmail: ${session?.user?.email}\n`
      output += `  accessToken: ${session?.access_token ? 'present' : 'missing'}\n`
      output += `  refreshToken: ${session?.refresh_token ? 'present' : 'missing'}\n`
      output += `  expiresAt: ${session?.expires_at}\n`
      output += `  currentTime: ${new Date().toISOString()}\n`
      output += `  error: ${sessionError?.message || 'none'}\n\n`
      
      if (!session) {
        output += '❌ No active session found. Please login first.\n'
        setDebugOutput(output)
        setIsDebugging(false)
        return
      }
      
      // Check auth context state
      output += `🏷️ Auth Context State:\n`
      output += `  user: ${user?.email}\n`
      output += `  userId: ${user?.id}\n`
      output += `  profile: ${JSON.stringify(user?.profile, null, 2)}\n`
      output += `  isAdmin: ${isAdmin}\n\n`
      
      // Try to fetch user profile directly
      output += '🔍 Fetching user profile directly...\n'
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      output += `👤 Profile result:\n`
      output += `  profile: ${JSON.stringify(profile, null, 2)}\n`
      output += `  hasProfile: ${!!profile}\n`
      output += `  profileRole: ${profile?.role}\n`
      if (profileError) {
        output += `  error: ${profileError.message}\n`
        output += `  code: ${profileError.code}\n`
        output += `  details: ${profileError.details}\n`
        output += `  hint: ${profileError.hint}\n`
      }
      output += '\n'
      
      // Try to fetch questions (this is what's failing)
      output += '🔍 Testing questions access...\n'
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('id, question_number, module_type, exam_id')
        .limit(5)
      
      output += `📝 Questions result:\n`
      output += `  questionsCount: ${questions?.length || 0}\n`
      output += `  sampleQuestions: ${JSON.stringify(questions?.slice(0, 2), null, 2)}\n`
      if (questionsError) {
        output += `  error: ${questionsError.message}\n`
        output += `  code: ${questionsError.code}\n`
        output += `  details: ${questionsError.details}\n`
        output += `  hint: ${questionsError.hint}\n`
      }
      output += '\n'
      
      // Check RLS function
      output += '🔍 Testing RLS helper function...\n'
      const { data: isAdminResult, error: rpcError } = await supabase
        .rpc('is_admin', { user_id: session.user.id })
      
      output += `🔐 RLS Admin check result:\n`
      output += `  isAdmin: ${isAdminResult}\n`
      if (rpcError) {
        output += `  error: ${rpcError.message}\n`
        output += `  code: ${rpcError.code}\n`
        output += `  details: ${rpcError.details}\n`
        output += `  hint: ${rpcError.hint}\n`
      }
      output += '\n'
      
      // Test verification function from the fix script
      output += '🔍 Testing verification function...\n'
      const { data: verifyResult, error: verifyError } = await supabase
        .rpc('verify_questions_access')
      
      output += `✅ Verification result:\n`
      output += `  result: ${JSON.stringify(verifyResult, null, 2)}\n`
      if (verifyError) {
        output += `  error: ${verifyError.message}\n`
        output += `  code: ${verifyError.code}\n`
        output += `  details: ${verifyError.details}\n`
        output += `  hint: ${verifyError.hint}\n`
      }
      
    } catch (error: any) {
      output += `❌ Unexpected error: ${error.message}\n`
      output += `Stack: ${error.stack}\n`
    }
    
    setDebugOutput(output)
    setIsDebugging(false)
  }

  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-yellow-800">Authentication Debug Tool</h3>
        <button
          onClick={debugAuth}
          disabled={isDebugging}
          className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDebugging ? 'Running Debug...' : 'Run Debug'}
        </button>
      </div>
      
      {debugOutput && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-md">
          <pre className="text-sm whitespace-pre-wrap font-mono">
            {debugOutput}
          </pre>
        </div>
      )}
    </div>
  )
}