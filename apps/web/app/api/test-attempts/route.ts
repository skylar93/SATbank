import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Check for impersonation data in request headers
    const impersonationHeader = request.headers.get('x-impersonation-data')
    let targetUserId = user.id
    
    if (impersonationHeader) {
      try {
        const impersonationData = JSON.parse(impersonationHeader)
        if (impersonationData.target_user && impersonationData.target_user.id) {
          targetUserId = impersonationData.target_user.id
        }
      } catch (error) {
        console.error('Failed to parse impersonation data:', error)
      }
    }
    
    const { data, error } = await supabase
      .from('test_attempts')
      .insert({
        ...body,
        user_id: targetUserId
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}