export type AIProvider = 'openai' | 'deepseek' | 'gemini' | 'claude'

export type ImageModel = 'gpt-image-1' | 'gpt-image-1-mini' | 'gpt-image-1.5' | 'gpt-image-2' | 'dall-e-3' | 'dall-e-2' | 'imagen-4.0-generate-001' | 'imagen-3.0-generate-001' | 'imagen' | 'flux'

export type TextModel = 'gpt-4o' | 'gpt-4-turbo' | 'deepseek-chat' | 'deepseek-reasoner' | 'gemini-pro' | 'gemini-flash' | 'claude-3-opus' | 'claude-3-sonnet'

export type ImageSize = 'auto' | '256x256' | '512x512' | '1024x1024' | '1536x1024' | '1024x1536' | '1792x1024' | '1024x1792'

export type ImageQuality = 'auto' | 'standard' | 'hd' | 'low' | 'medium' | 'high'

export type ImageStyle = 'vivid' | 'natural'

export interface ImageGenParams {
  prompt: string
  provider?: AIProvider
  model?: ImageModel
  size?: ImageSize
  quality?: ImageQuality
  style?: ImageStyle
  n?: number
  negativePrompt?: string
  aspectRatio?: string
  guidanceScale?: number
  seed?: number
}

export interface ImageGenResult {
  url: string
  buffer?: Buffer
  revisedPrompt?: string
  provider: AIProvider
  model: string
  width: number
  height: number
  seed?: number
}

export interface ImageGenResponse {
  success: boolean
  images: ImageGenResult[]
  error?: string
  cost?: number
}

export interface TextGenParams {
  prompt: string
  system?: string
  provider?: AIProvider
  model?: TextModel
  maxTokens?: number
  temperature?: number
}

export interface TextGenResponse {
  success: boolean
  text: string
  provider: AIProvider
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
  }
  error?: string
}

export interface AIProviderConfig {
  name: AIProvider
  label: string
  emoji: string
  imageModels: ImageModel[]
  textModels: TextModel[]
  requiresAuth: boolean
  envKey: string
}
