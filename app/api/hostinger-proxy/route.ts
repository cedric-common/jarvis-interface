import { NextResponse } from 'next/server'
import { fetchHostinger, getCorsHeaders } from '@/lib/hostinger'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const { endpoint, method = 'GET', body } = payload

    if (!endpoint || typeof endpoint !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid endpoint' },
        { status: 400, headers: getCorsHeaders() }
      )
    }

    const data = await fetchHostinger(endpoint, {
      method,
      body,
    })

    return NextResponse.json(data, { headers: getCorsHeaders() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: getCorsHeaders() }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  })
}
