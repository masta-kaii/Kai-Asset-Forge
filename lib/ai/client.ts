import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import type { ImageGenParams, ImageGenResponse, ImageGenResult, TextGenParams, TextGenResponse, AIProvider } from "./types"

function getClient(provider?: AIProvider): OpenAI {
  const isDeepseek = provider === "deepseek"
  const apiKey = isDeepseek ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY
  const keyName = isDeepseek ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"

  if (!apiKey) {
    throw new Error(`${keyName} is missing. Add it in Vercel → Settings → Environment Variables.`)
  }

  if (isDeepseek) {
    return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" })
  }
  return new OpenAI({ apiKey })
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
      model: "gpt-image-1",
      prompt: params.prompt,
      n,
      size: size === "auto" ? "auto" : size,
      quality: params.quality ?? "auto",
    })

    const data = response.data ?? []
    const images: ImageGenResult[] = data.map((img) => {
      let url = img.url ?? ""
      let buffer: Buffer | undefined

      if (!url && img.b64_json) {
        buffer = Buffer.from(img.b64_json, "base64")
        url = `data:image/png;base64,${img.b64_json}`
      }

      return {
        url,
        buffer,
        revisedPrompt: img.revised_prompt ?? undefined,
        provider: "openai",
        model: "gpt-image-1",
        ...parseSize(size),
      }
    })

    return { success: true, images }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("OpenAI image generation error:", message)
    return {
      success: false,
      images: [],
      error: `OpenAI image generation failed: ${message}. Check OPENAI_API_KEY in Vercel env vars and billing at platform.openai.com.`,
    }
  }
}

export async function generateTextWithClaude(params: {
  system?: string
  prompt?: string
  messages?: { role: "user" | "assistant"; content: string }[]
  model?: string
  maxTokens?: number
  temperature?: number
}): Promise<TextGenResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      success: false,
      text: "",
      provider: "claude",
      model: params.model ?? "claude-sonnet-4-20250514",
      error: "ANTHROPIC_API_KEY is missing. Add it in Vercel → Settings → Environment Variables.",
    }
  }

  const anthropic = new Anthropic({ apiKey })
  const model = params.model ?? "claude-sonnet-4-20250514"

  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages: params.messages ?? [{ role: "user", content: params.prompt ?? "" }],
      temperature: params.temperature,
    })

    const text = msg.content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("\n")

    return {
      success: true,
      text,
      provider: "claude",
      model,
      usage: {
        promptTokens: msg.usage?.input_tokens ?? 0,
        completionTokens: msg.usage?.output_tokens ?? 0,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("Claude text generation error:", message)
    return {
      success: false,
      text: "",
      provider: "claude",
      model,
      error: `Claude generation failed: ${message}. Check ANTHROPIC_API_KEY in Vercel.`,
    }
  }
}

export async function generateText(params: TextGenParams): Promise<TextGenResponse> {
  const client = getClient(params.provider)
  const model = params.model ?? (params.provider === "deepseek" ? "deepseek-chat" : "gpt-4o")

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
    const provider = params.provider ?? "openai"
    console.error(`${provider} text generation error:`, message)
    return {
      success: false,
      text: "",
      provider: provider as "openai" | "deepseek",
      model,
      error: `${provider} text generation failed: ${message}. Check ${provider === "deepseek" ? "DEEPSEEK_API_KEY" : "OPENAI_API_KEY"} in Vercel.`,
    }
  }
}
