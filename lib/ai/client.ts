import OpenAI from "openai"
import type { ImageGenParams, ImageGenResponse, ImageGenResult, TextGenParams, TextGenResponse } from "./types"

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return new OpenAI({ apiKey })
}

const SIZE_MAP: Record<string, `${number}x${number}`> = {
  "256x256": "256x256",
  "512x512": "512x512",
  "1024x1024": "1024x1024",
  "1792x1024": "1792x1024",
  "1024x1792": "1024x1792",
}

function parseSize(size: string): { width: number; height: number } {
  const [w, h] = size.split("x").map(Number)
  return { width: w ?? 1024, height: h ?? 1024 }
}

export async function generateImage(params: ImageGenParams): Promise<ImageGenResponse> {
  const client = getClient()
  const size = params.size ?? "1024x1024"
  const n = params.n ?? 1

  try {
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: params.prompt,
      n,
      size: SIZE_MAP[size] ?? "1024x1024",
      quality: params.quality ?? "standard",
    })

    const data = response.data ?? []
    const images: ImageGenResult[] = data.map((img) => ({
      url: img.url ?? "",
      revisedPrompt: img.revised_prompt ?? undefined,
      provider: "openai",
      model: "dall-e-3",
      ...parseSize(size),
    }))

    return { success: true, images }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, images: [], error: message }
  }
}

export async function generateText(params: TextGenParams): Promise<TextGenResponse> {
  const client = getClient()
  const model = params.model ?? "gpt-4o"

  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
    if (params.system) {
      messages.push({ role: "system", content: params.system })
    }
    messages.push({ role: "user", content: params.prompt })

    const response = await client.chat.completions.create({
      model,
      messages,
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    })

    return {
      success: true,
      text: response.choices[0]?.message?.content ?? "",
      provider: "openai",
      model,
      usage: response.usage
        ? { promptTokens: response.usage.prompt_tokens, completionTokens: response.usage.completion_tokens }
        : undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, text: "", provider: "openai", model, error: message }
  }
}
