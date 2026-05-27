import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const WEB_DIR = join(process.cwd(), 'forge-output', 'web')

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const file = searchParams.get('file')

  if (!file) {
    return NextResponse.json({ error: 'file param required' }, { status: 400 })
  }

  // Security: only allow files within forge-output/web/
  const safePath = join(WEB_DIR, file.replace(/\.\./g, '').replace(/\\/g, '/'))
  if (!safePath.startsWith(WEB_DIR) || !existsSync(safePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const html = await readFile(safePath, 'utf-8')
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}
