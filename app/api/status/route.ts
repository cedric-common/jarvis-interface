import { NextResponse } from 'next/server'
import { fetchHostinger, getCorsHeaders } from '@/lib/hostinger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [vpsData, sitesData] = await Promise.allSettled([
      fetchHostinger('/vps/v1/virtual-machines'),
      fetchHostinger('/hosting/v1/websites'),
    ])

    let vpsList: Array<{ status?: string }> = []
    let sitesList: Array<unknown> = []

    if (vpsData.status === 'fulfilled') {
      const data = vpsData.value
      vpsList = Array.isArray(data) ? data : data?.data || []
    }

    if (sitesData.status === 'fulfilled') {
      const data = sitesData.value
      sitesList = Array.isArray(data) ? data : data?.data || []
    }

    const totalVps = vpsList.length
    const onlineVps = vpsList.filter(
      (vps) => vps.status === 'running' || vps.status === 'online' || vps.status === 'active'
    ).length

    const result = {
      vpsCount: totalVps,
      sitesCount: sitesList.length,
      onlineVps,
      totalVps,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json(result, { headers: getCorsHeaders() })
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
