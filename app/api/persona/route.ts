import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { NextResponse } from 'next/server'

const PERSONA_PATH = join(process.cwd(), 'data', 'agent-personas.json')

interface Persona {
  personality: string
  rules: string[]
  communicationStyle: string
  constraints: string[]
}

async function readPersonas(): Promise<Record<string, Persona>> {
  try {
    const raw = await readFile(PERSONA_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

async function writePersonas(data: Record<string, Persona>) {
  await writeFile(PERSONA_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET(): Promise<NextResponse> {
  const personas = await readPersonas()
  return NextResponse.json(personas)
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { agentId, persona } = await request.json()
    if (!agentId || !persona) {
      return NextResponse.json({ error: 'agentId and persona required' }, { status: 400 })
    }

    const personas = await readPersonas()
    personas[agentId] = {
      personality: persona.personality || '',
      rules: persona.rules || [],
      communicationStyle: persona.communicationStyle || 'direct',
      constraints: persona.constraints || [],
    }
    await writePersonas(personas)

    return NextResponse.json({ success: true, agentId, persona: personas[agentId] })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
