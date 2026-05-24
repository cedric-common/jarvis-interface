import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const WEATHER_CODES: Record<number, string> = {
  0: 'ciel dégagé',
  1: 'principalement dégagé',
  2: 'partiellement nuageux',
  3: 'couvert',
  45: 'brouillard',
  48: 'brouillard givrant',
  51: 'bruine légère',
  53: 'bruine modérée',
  55: 'bruine dense',
  61: 'pluie faible',
  63: 'pluie modérée',
  65: 'forte pluie',
  71: 'neige faible',
  73: 'neige modérée',
  75: 'forte neige',
  80: 'averses faibles',
  81: 'averses modérées',
  82: 'averses fortes',
  95: 'orage',
  96: 'orage avec grêle faible',
  99: 'orage avec forte grêle',
}

export async function GET() {
  try {
    // Solenzara, Corse — destination météo par défaut de Cédric.
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', '41.858')
    url.searchParams.set('longitude', '9.399')
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m')
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_probability_max')
    url.searchParams.set('timezone', 'Europe/Paris')
    url.searchParams.set('forecast_days', '1')

    const res = await fetch(url, { next: { revalidate: 300 } })
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`)
    }

    const data = await res.json()
    const current = data.current ?? {}
    const daily = data.daily ?? {}
    const code = Number(current.weather_code)

    return NextResponse.json(
      {
        location: 'Solenzara',
        description: WEATHER_CODES[code] ?? 'conditions météo indisponibles',
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation,
        windSpeed: current.wind_speed_10m,
        windGusts: current.wind_gusts_10m,
        tempMin: daily.temperature_2m_min?.[0],
        tempMax: daily.temperature_2m_max?.[0],
        precipitationProbability: daily.precipitation_probability_max?.[0],
        updatedAt: current.time,
      },
      { headers: CORS_HEADERS }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: message },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  })
}
