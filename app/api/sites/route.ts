import { NextResponse } from 'next/server'
import { fetchHostinger, getCorsHeaders } from '@/lib/hostinger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await fetchHostinger('/hosting/v1/websites')
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
