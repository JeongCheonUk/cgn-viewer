import { neon } from '@neondatabase/serverless'

export interface Env {
  DATABASE_URL: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const DISTRIBUTION_CHANNEL_MAP: Record<string, string> = {
  'E15D57VIMXXD29': '한국',
  'E11L0Y56RBUUCO': '중문',
  'E16T8YPKJXB2OJ': '미국',
  'E3QZ563087DL4W': '일본',
}

function parseCSVLine(line: string, delimiter: string): string[] {
  if (delimiter === '\t') return line.split('\t').map(v => v.replace(/"/g, '').trim())
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { inQuotes = !inQuotes }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else { current += ch }
  }
  result.push(current.trim())
  return result
}

function parseCloudFrontCSV(content: string) {
  const lines = content.split('\n')

  // DistributionID 추출 (3번째 줄)
  let distributionId = ''
  if (lines.length > 2) {
    const distLine = lines[2]
    const quoted = distLine.match(/"([A-Z0-9]+)"/g)
    if (quoted && quoted.length > 1) {
      distributionId = quoted[1].replace(/"/g, '')
    } else {
      const parts = distLine.split(/[,\t]/)
      if (parts.length > 1) distributionId = parts[1].trim().replace(/"/g, '')
    }
  }

  const channelName = DISTRIBUTION_CHANNEL_MAP[distributionId] || ''
  if (!channelName) throw new Error('알 수 없는 DistributionID입니다.')

  // 날짜 추출 (4~5번째 줄)
  const startMatch = lines[3]?.match(/(\d{4}-\d{2}-\d{2})/)
  const endMatch = lines[4]?.match(/(\d{4}-\d{2}-\d{2})/)
  if (!startMatch || !endMatch) throw new Error('CSV에서 날짜를 찾을 수 없습니다.')

  const startDate = startMatch[1]
  const endDate = endMatch[1]
  if (startDate !== endDate) throw new Error('하루 단위 CSV만 업로드 가능합니다.')

  // 8번째 줄부터 데이터 파싱
  const dataLines = lines.slice(7).filter(l => l.trim())
  if (dataLines.length === 0) throw new Error('데이터가 없습니다.')

  const delimiter = dataLines[0].includes('\t') ? '\t' : ','
  const headers = parseCSVLine(dataLines[0], delimiter)

  const statsMap = new Map<string, { requestCount: number; bytesTotal: number }>()

  for (let i = 1; i < dataLines.length; i++) {
    const values = parseCSVLine(dataLines[i], delimiter)
    const record: Record<string, string> = {}
    headers.forEach((h, idx) => { record[h] = values[idx] || '' })

    const country = record['LocationName'] || record['LocationCode'] || 'Unknown'
    const requests = parseInt(record['Requests']) || 0
    const bytesStr = record['TotalBytes'] || '0'
    const bytes = bytesStr.includes('E+') || bytesStr.includes('e+')
      ? Math.floor(parseFloat(bytesStr))
      : parseInt(bytesStr.replace(/,/g, '')) || 0

    const existing = statsMap.get(country) || { requestCount: 0, bytesTotal: 0 }
    statsMap.set(country, {
      requestCount: existing.requestCount + requests,
      bytesTotal: existing.bytesTotal + bytes,
    })
  }

  const totalRequests = Array.from(statsMap.values()).reduce((s, v) => s + v.requestCount, 0)
  const stats = Array.from(statsMap.entries()).map(([country, v]) => ({
    country,
    requestCount: v.requestCount,
    bytesTotal: v.bytesTotal,
    requestPercent: totalRequests > 0 ? ((v.requestCount / totalRequests) * 100).toFixed(2) : '0.00',
    bytesMB: (v.bytesTotal / (1024 * 1024)).toFixed(2),
  })).sort((a, b) => b.requestCount - a.requestCount)

  return { date: startDate, channelName, distributionId, stats, totalRequests }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    const url = new URL(request.url)
    const sql = neon(env.DATABASE_URL)

    try {
      // GET /api/channels
      if (url.pathname === '/api/channels' && request.method === 'GET') {
        const rows = await sql`SELECT * FROM channels ORDER BY id`
        return Response.json(rows, { headers: corsHeaders })
      }

      // GET /api/channels/:id
      const channelMatch = url.pathname.match(/^\/api\/channels\/(\d+)$/)
      if (channelMatch && request.method === 'GET') {
        const rows = await sql`SELECT * FROM channels WHERE id = ${channelMatch[1]}`
        if (rows.length === 0) return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders })
        return Response.json(rows[0], { headers: corsHeaders })
      }

      // POST /api/data/upload
      if (url.pathname === '/api/data/upload' && request.method === 'POST') {
        const formData = await request.formData()
        const file = formData.get('file') as File | null
        if (!file) return Response.json({ error: '파일이 없습니다.' }, { status: 400, headers: corsHeaders })
        if (!file.name.endsWith('.csv')) return Response.json({ error: 'CSV 파일만 업로드 가능합니다.' }, { status: 400, headers: corsHeaders })

        const content = await file.text()
        const parsed = parseCloudFrontCSV(content)

        const channelRows = await sql`SELECT id FROM channels WHERE name = ${parsed.channelName}`
        if (channelRows.length === 0) return Response.json({ error: `${parsed.channelName} 채널을 찾을 수 없습니다.` }, { status: 400, headers: corsHeaders })
        const channelId = channelRows[0].id

        await sql`DELETE FROM cloudfront_stats WHERE channel_id = ${channelId} AND data_date = ${parsed.date}`
        await sql`DELETE FROM uploads WHERE channel_id = ${channelId} AND upload_date = ${parsed.date}`

        const uploadRows = await sql`INSERT INTO uploads (channel_id, upload_date, file_name) VALUES (${channelId}, ${parsed.date}, ${file.name}) RETURNING id`
        const uploadId = uploadRows[0].id

        for (const stat of parsed.stats) {
          await sql`INSERT INTO cloudfront_stats (upload_id, channel_id, data_date, country, request_count, bytes_total) VALUES (${uploadId}, ${channelId}, ${parsed.date}, ${stat.country}, ${stat.requestCount}, ${stat.bytesTotal})`
        }

        return Response.json({ message: '업로드 성공', uploadId, channelId, date: parsed.date, statsCount: parsed.stats.length }, { headers: corsHeaders })
      }

      // GET /api/data/dates/:channelId
      const datesMatch = url.pathname.match(/^\/api\/data\/dates\/(\d+)$/)
      if (datesMatch && request.method === 'GET') {
        const rows = await sql`SELECT DISTINCT upload_date, id, file_name, created_at FROM uploads WHERE channel_id = ${datesMatch[1]} ORDER BY upload_date DESC`
        return Response.json(rows, { headers: corsHeaders })
      }

      // GET /api/data/stats/:channelId/:startDate/:endDate?
      const statsMatch = url.pathname.match(/^\/api\/data\/stats\/(\d+)\/(\d{4}-\d{2}-\d{2})(?:\/(\d{4}-\d{2}-\d{2}))?$/)
      if (statsMatch && request.method === 'GET') {
        const [, channelId, startDate, endDate] = statsMatch
        const rows = endDate
          ? await sql`SELECT country, SUM(request_count) as request_count, SUM(bytes_total) as bytes_total FROM cloudfront_stats WHERE channel_id = ${channelId} AND data_date BETWEEN ${startDate} AND ${endDate} GROUP BY country ORDER BY request_count DESC`
          : await sql`SELECT country, SUM(request_count) as request_count, SUM(bytes_total) as bytes_total FROM cloudfront_stats WHERE channel_id = ${channelId} AND data_date = ${startDate} GROUP BY country ORDER BY request_count DESC`

        const totalRequests = rows.reduce((s: number, r: { request_count: string }) => s + parseInt(r.request_count), 0)
        const stats = rows.map((r: { country: string; request_count: string; bytes_total: string }) => ({
          country: r.country,
          requestCount: parseInt(r.request_count),
          requestPercent: totalRequests > 0 ? ((parseInt(r.request_count) / totalRequests) * 100).toFixed(2) : '0.00',
          bytesMB: (parseInt(r.bytes_total) / (1024 * 1024)).toFixed(2),
        }))

        return Response.json(
          endDate ? { startDate, endDate, totalRequests, stats } : { date: startDate, totalRequests, stats },
          { headers: corsHeaders }
        )
      }

      if (url.pathname === '/health') {
        return Response.json({ status: 'ok' }, { headers: corsHeaders })
      }

      return new Response('Not Found', { status: 404 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: String(error) }, { status: 500, headers: corsHeaders })
    }
  },
}
