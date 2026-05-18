export interface BudgetConfig {
  dailyCap: number
  monthlyCap: number
  enabled: boolean
  pauseOnExceed: boolean
}

export interface BudgetStatus {
  dailyUsed: number
  monthlyUsed: number
  dailyRemaining: number
  monthlyRemaining: number
  dailyCap: number
  monthlyCap: number
  dailyPercent: number
  monthlyPercent: number
  isExceeded: boolean
  lastResetDaily: string
  lastResetMonthly: string
}

export interface CostEntry {
  id: string
  provider: string
  model: string
  operation: "image_gen" | "text_gen" | "storage_upload"
  inputTokens?: number
  outputTokens?: number
  imageCount?: number
  imageSize?: string
  cost: number
  currency: string
  metadata: Record<string, string>
  createdAt: string
}

export const DEFAULT_BUDGET: BudgetConfig = {
  dailyCap: 0.33,
  monthlyCap: 10,
  enabled: true,
  pauseOnExceed: true,
}

// Approximate costs per operation (USD)
export const COST_RATES = {
  gemini: {
    imagen_generate_1k: 0.0025,
  },
  openai: {
    gpt_image_1k: 0.004,
    gpt4o_prompt: 2.5 / 1_000_000,
    gpt4o_completion: 10 / 1_000_000,
  },
  deepseek: {
    chat_prompt: 0.14 / 1_000_000,
    chat_completion: 0.28 / 1_000_000,
  },
}
