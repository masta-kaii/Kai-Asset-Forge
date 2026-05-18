const ITCHIO_API_BASE = "https://itch.io/api/1"

interface ItchIOConfig {
  apiKey: string
}

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

function getApiKey(): string {
  const key = process.env.ITCHIO_API_KEY
  if (!key) throw new Error("ITCHIO_API_KEY is not configured")
  return key
}

export async function publishToItchIO(params: {
  title: string
  description: string
  price: number
  tags: string[]
  files: { name: string; url: string }[]
  aiDisclosure: boolean
}): Promise<UploadResult> {
  try {
    const key = getApiKey()

    const body = new URLSearchParams({
      api_key: key,
      title: params.title,
      description: `${params.description}\n\n${params.aiDisclosure ? "AI Disclosure: Graphics generated with AI assistance." : ""}`,
      classification: "game_assets",
      tags: [...params.tags, params.aiDisclosure ? "ai-generated" : ""].filter(Boolean).join(","),
      price: params.price > 0 ? String(Math.round(params.price * 100)) : "0",
      published: "false",
    })

    const response = await fetch(`${ITCHIO_API_BASE}/${key}/game/upload`, {
      method: "POST",
      body,
    })

    if (!response.ok) {
      return { success: false, error: `itch.io: ${response.status} ${response.statusText}` }
    }

    const data = await response.json()
    return { success: true, url: data.url }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "itch.io upload failed"
    return { success: false, error: msg }
  }
}

export function isItchIOConfigured(): boolean {
  return !!process.env.ITCHIO_API_KEY
}
