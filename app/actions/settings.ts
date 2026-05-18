"use server"

export async function getApiKeyStatus(): Promise<{
  openai: boolean
  deepseek: boolean
  itch: boolean
  gumroad: boolean
  firebase: boolean
}> {
  return {
    firebase: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    itch: !!process.env.ITCHIO_API_KEY,
    gumroad: !!process.env.GUMROAD_ACCESS_TOKEN,
  }
}
