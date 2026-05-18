import { DEFAULT_BUDGET, type BudgetConfig, type BudgetStatus } from "./types"

let budgetConfig: BudgetConfig = { ...DEFAULT_BUDGET }

// ── In-memory daily tracking (resets on process restart) ──
// For serverless, we persist to the config object which lives in-memory per instance
// Full persistence requires Firestore reads, which we add below
let dailyUsed = 0
let monthlyUsed = 0
let dailyResetDate = new Date().toDateString()
let monthlyResetDate = `${new Date().getFullYear()}-${new Date().getMonth()}`

function checkDateReset() {
  const today = new Date().toDateString()
  const thisMonth = `${new Date().getFullYear()}-${new Date().getMonth()}`

  if (today !== dailyResetDate) {
    dailyUsed = 0
    dailyResetDate = today
  }
  if (thisMonth !== monthlyResetDate) {
    monthlyUsed = 0
    monthlyResetDate = thisMonth
  }
}

export function getBudgetStatus(): BudgetStatus {
  checkDateReset()
  const dailyRemaining = Math.max(0, budgetConfig.dailyCap - dailyUsed)
  const monthlyRemaining = Math.max(0, budgetConfig.monthlyCap - monthlyUsed)

  return {
    dailyUsed: Math.round(dailyUsed * 10000) / 10000,
    monthlyUsed: Math.round(monthlyUsed * 10000) / 10000,
    dailyRemaining: Math.round(dailyRemaining * 10000) / 10000,
    monthlyRemaining: Math.round(monthlyRemaining * 10000) / 10000,
    dailyCap: budgetConfig.dailyCap,
    monthlyCap: budgetConfig.monthlyCap,
    dailyPercent: Math.round((dailyUsed / budgetConfig.dailyCap) * 100),
    monthlyPercent: Math.round((monthlyUsed / budgetConfig.monthlyCap) * 100),
    isExceeded: dailyRemaining <= 0 || monthlyRemaining <= 0,
    lastResetDaily: dailyResetDate,
    lastResetMonthly: monthlyResetDate,
  }
}

export function canProceed(estimatedCost: number): { allowed: boolean; reason?: string } {
  if (!budgetConfig.enabled) return { allowed: true }

  checkDateReset()
  const status = getBudgetStatus()

  if (status.dailyRemaining < estimatedCost) {
    return {
      allowed: false,
      reason: `Daily budget exceeded ($${status.dailyUsed.toFixed(2)}/$${status.dailyCap.toFixed(2)}). Resets tomorrow.`,
    }
  }

  if (status.monthlyRemaining < estimatedCost) {
    return {
      allowed: false,
      reason: `Monthly budget exceeded ($${status.monthlyUsed.toFixed(2)}/$${status.monthlyCap.toFixed(2)}). Resets next month.`,
    }
  }

  return { allowed: true }
}

export function recordCost(cost: number): void {
  dailyUsed += cost
  monthlyUsed += cost
}

export function updateBudgetConfig(partial: Partial<BudgetConfig>): void {
  budgetConfig = { ...budgetConfig, ...partial }
}

export function resetDaily(): void {
  dailyUsed = 0
  dailyResetDate = new Date().toDateString()
}
