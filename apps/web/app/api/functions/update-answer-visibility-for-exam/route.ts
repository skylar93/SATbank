import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get Supabase URL and Key from environment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseFunctionUrl = `${supabaseUrl}/functions/v1/update-answer-visibility-for-exam`
    
    // Forward the request to the Edge Function
    const body = await request.text()
    const headers = new Headers()
    
    // Forward relevant headers
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      headers.set('authorization', authHeader)
    }
    
    headers.set('content-type', 'application/json')
    
    const response = await fetch(supabaseFunctionUrl, {
      method: 'POST',
      headers,
      body
    })
    
    const data = await response.text()
    
    return new Response(data, {
      status: response.status,
      headers: {
        'content-type': 'application/json',
      }
    })
    
  } catch (error) {
    console.error('API route error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        }
      }
    )
  }
}