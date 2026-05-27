import { execSync } from 'child_process'
import { NextResponse } from 'next/server'

export async function GET(): Promise<NextResponse> {
  try {
    const out = execSync('hermes --version 2>&1', { encoding: 'utf-8', timeout: 5000 })
    return NextResponse.json({
      status: 'online',
      gateway: 'connected',
      version: (out.match(/[\d]+\.[\d]+\.[\d]+/) || ['unknown'])[0],
      timestamp: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({
      status: 'offline',
      gateway: 'disconnected',
      version: null,
      timestamp: new Date().toISOString(),
    })
  }
}
