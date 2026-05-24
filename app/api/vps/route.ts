import { NextResponse } from 'next/server'
import { fetchHostinger, getCorsHeaders } from '@/lib/hostinger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await fetchHostinger('/vps/v1/virtual-machines')
    const filteredData = Array.isArray(data)
      ? data.filter((vps: { state?: string; status?: string }) => (vps.state || vps.status) !== 'destroyed')
      : data
    return NextResponse.json(filteredData, { headers: getCorsHeaders() })
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
