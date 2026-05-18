const GUMROAD_API_BASE = "https://api.gumroad.com/v2"

interface UploadResult {
  success: boolean
  url?: string
  productId?: string
  error?: string
}

function getAccessToken(): string {
  const token = process.env.GUMROAD_ACCESS_TOKEN
  if (!token) throw new Error("GUMROAD_ACCESS_TOKEN is not configured")
  return token
}

export async function publishToGumroad(params: {
  title: string
  description: string
  price: number
  tags: string[]
  previewUrl: string
  aiDisclosure: boolean
}): Promise<UploadResult> {
  try {
    const token = getAccessToken()

    const body = {
      product: {
        name: params.title,
        description: `${params.description}${params.aiDisclosure ? "\n\nAI Disclosure: Graphics generated with AI assistance." : ""}`,
        price: Math.round(params.price * 100),
        tags: [...params.tags, params.aiDisclosure ? "ai-generated" : ""].filter(Boolean),
        preview_url: params.previewUrl || undefined,
        published: false,
      },
    }

    const response = await fetch(`${GUMROAD_API_BASE}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      return { success: false, error: `Gumroad: ${response.status} ${response.statusText}` }
    }

    const data = await response.json()
    return { success: true, url: data.product?.short_url, productId: data.product?.id }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Gumroad upload failed"
    return { success: false, error: msg }
  }
}

export function isGumroadConfigured(): boolean {
  return !!process.env.GUMROAD_ACCESS_TOKEN
}
