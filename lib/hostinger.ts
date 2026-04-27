const HOSTINGER_API_BASE = 'https://developers.hostinger.com/api'

export interface FetchHostingerOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: Record<string, unknown>
  headers?: Record<string, string>
}

export function getCorsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export async function fetchHostinger(
  endpoint: string,
  options: FetchHostingerOptions = {}
) {
  const token = process.env.HOSTINGER_API_TOKEN

  if (!token) {
    throw new Error('Missing HOSTINGER_API_TOKEN environment variable')
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${HOSTINGER_API_BASE}${endpoint}`

  const fetchOptions: RequestInit = {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  }

  if (options.body && fetchOptions.method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, fetchOptions)

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error')
    throw new Error(
      `Hostinger API error: ${response.status} ${response.statusText} - ${errorBody}`
    )
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}
