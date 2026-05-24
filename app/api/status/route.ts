import { NextResponse } from 'next/server'
import { fetchHostinger, getCorsHeaders } from '@/lib/hostinger'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const fetchAllSites = async () => {
      const allSites: Array<unknown> = []
      for (let page = 1; page <= 10; page += 1) {
        const data = await fetchHostinger(`/hosting/v1/websites?page=${page}&per_page=100`)
        const dataRecord = data as { data?: unknown }
        const pageSites = Array.isArray(data)
          ? data
          : Array.isArray(dataRecord.data)
            ? dataRecord.data
            : []
        allSites.push(...pageSites)
        if (!Array.isArray(pageSites) || pageSites.length < 100) break
      }
      return allSites
    }

    const [vpsData, sitesData] = await Promise.allSettled([
      fetchHostinger('/vps/v1/virtual-machines'),
      fetchAllSites(),
    ])

    let vpsList: Array<{ status?: string; state?: string }> = []
    let sitesList: Array<unknown> = []

    if (vpsData.status === 'fulfilled') {
      const data = vpsData.value
      const dataRecord = data as { data?: Array<{ status?: string; state?: string }> }
      vpsList = Array.isArray(data) ? data : dataRecord.data || []
    }

    if (sitesData.status === 'fulfilled') {
      sitesList = sitesData.value
    }

    const totalVps = vpsList.length
    const onlineVps = vpsList.filter(
      (vps) => {
        const state = vps.state || vps.status
        return state === 'running' || state === 'online' || state === 'active'
      }
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
