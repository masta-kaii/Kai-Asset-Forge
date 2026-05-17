import OpenAI from "openai"
import { GoogleGenAI } from "@google/genai"
import type { ImageGenParams, ImageGenResponse, ImageGenResult, TextGenParams, TextGenResponse, AIProvider } from "./types"

function getClient(provider?: AIProvider): OpenAI {
  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured")
    }
    return new OpenAI({ apiKey, baseURL: "https://api.deepseek.com/v1" })
  }
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }
  return new OpenAI({ apiKey })
}

function parseSize(size: string): { width: number; height: number } {
  const [w, h] = size.split("x").map(Number)
  return { width: w ?? 1024, height: h ?? 1024 }
}

export async function generateImage(params: ImageGenParams): Promise<ImageGenResponse> {
  const provider = params.provider ?? "openai"
  switch (provider) {
    case "gemini":
      return generateImageWithGemini(params)
    default:
      return generateImageWithOpenAI(params)
  }
}

async function generateImageWithOpenAI(params: ImageGenParams): Promise<ImageGenResponse> {
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
    return { success: false, images: [], error: message }
  }
}

async function generateImageWithGemini(params: ImageGenParams): Promise<ImageGenResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return { success: false, images: [], error: "GEMINI_API_KEY is not configured" }
  }

  const ai = new GoogleGenAI({ apiKey })
  const model = params.model ?? "imagen-4.0-generate-001"
  const n = params.n ?? 1

  try {
    const response = await ai.models.generateImages({
      model,
      prompt: params.prompt,
      config: {
        numberOfImages: n,
        aspectRatio: params.aspectRatio ?? "1:1",
        negativePrompt: params.negativePrompt,
        guidanceScale: params.guidanceScale,
        seed: params.seed,
      },
    })

    const generatedImages = response.generatedImages ?? []
    if (generatedImages.length === 0) {
      return { success: false, images: [], error: "No images generated" }
    }

    const images: ImageGenResult[] = generatedImages
      .filter((g) => g.image?.imageBytes)
      .map((g) => {
        const b64 = g.image!.imageBytes!
        const buffer = Buffer.from(b64, "base64")
        return {
          url: `data:image/png;base64,${b64}`,
          buffer,
          provider: "gemini",
          model,
          width: 1024,
          height: 1024,
        }
      })

    if (images.length === 0) {
      return { success: false, images: [], error: "All generated images were filtered by safety checks" }
    }

    return { success: true, images }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { success: false, images: [], error: message }
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
    return { success: false, text: "", provider: "openai", model, error: message }
  }
}
