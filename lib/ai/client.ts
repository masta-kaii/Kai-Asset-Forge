import OpenAI from "openai"
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
