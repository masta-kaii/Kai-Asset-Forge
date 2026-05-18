import { doc, getDoc, setDoc, updateDoc, increment, Timestamp } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { DEFAULT_BUDGET, type BudgetConfig, type BudgetStatus } from "./types"

const BUDGET_DOC = "config/budget"

function todayKey(): string { return new Date().toISOString().slice(0, 10) }
function monthKey(): string { return new Date().toISOString().slice(0, 7) }

async function ensureDoc(): Promise<void> {
  const db = getDb()
  const snap = await getDoc(doc(db, BUDGET_DOC))
  if (!snap.exists()) {
    await setDoc(doc(db, BUDGET_DOC), {
      dailyUsed: 0, monthlyUsed: 0,
      dailyResetDate: todayKey(), monthlyResetMonth: monthKey(),
      dailyCap: DEFAULT_BUDGET.dailyCap, monthlyCap: DEFAULT_BUDGET.monthlyCap,
      enabled: true,
    })
  }
}

async function resetIfNeeded(): Promise<void> {
  const db = getDb()
  const snap = await getDoc(doc(db, BUDGET_DOC))
  if (!snap.exists()) {
    ensureDoc()
    return
  }
  const data = snap.data()
  const updates: Record<string, unknown> = {}
  if (data.dailyResetDate !== todayKey()) {
    updates.dailyUsed = 0
    updates.dailyResetDate = todayKey()
  }
  if (data.monthlyResetMonth !== monthKey()) {
    updates.monthlyUsed = 0
    updates.monthlyResetMonth = monthKey()
  }
  if (Object.keys(updates).length > 0) {
    await updateDoc(doc(db, BUDGET_DOC), updates)
  }
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  await resetIfNeeded()
  const db = getDb()
  const snap = await getDoc(doc(db, BUDGET_DOC))
  const data = snap.data() ?? {}
  const monthlyCap = (data.monthlyCap as number) ?? DEFAULT_BUDGET.monthlyCap
  const dailyCap = (data.dailyCap as number) ?? DEFAULT_BUDGET.dailyCap
  const monthlyUsed = (data.monthlyUsed as number) ?? 0
  const dailyUsed = (data.dailyUsed as number) ?? 0
  const dailyRemaining = Math.max(0, dailyCap - dailyUsed)
  const monthlyRemaining = Math.max(0, monthlyCap - monthlyUsed)

  return {
    dailyUsed: Math.round(dailyUsed * 10000) / 10000,
    monthlyUsed: Math.round(monthlyUsed * 10000) / 10000,
    dailyRemaining: Math.round(dailyRemaining * 10000) / 10000,
    monthlyRemaining: Math.round(monthlyRemaining * 10000) / 10000,
    dailyCap, monthlyCap,
    dailyPercent: dailyCap > 0 ? Math.round((dailyUsed / dailyCap) * 100) : 0,
    monthlyPercent: monthlyCap > 0 ? Math.round((monthlyUsed / monthlyCap) * 100) : 0,
    isExceeded: dailyRemaining <= 0 || monthlyRemaining <= 0,
    lastResetDaily: (data.dailyResetDate as string) ?? todayKey(),
    lastResetMonthly: (data.monthlyResetMonth as string) ?? monthKey(),
  }
}

export async function canProceed(estimatedCost: number): Promise<{ allowed: boolean; reason?: string }> {
  await resetIfNeeded()
  const status = await getBudgetStatus()
  const enabled = ((await getBudgetConfig()).enabled)
  if (!enabled) return { allowed: true }

  if (status.dailyRemaining < estimatedCost) {
    return { allowed: false, reason: `Daily budget exceeded ($${status.dailyUsed.toFixed(2)}/$${status.dailyCap.toFixed(2)})` }
  }
  if (status.monthlyRemaining < estimatedCost) {
    return { allowed: false, reason: `Monthly budget exceeded ($${status.monthlyUsed.toFixed(2)}/$${status.monthlyCap.toFixed(2)})` }
  }
  return { allowed: true }
}

export async function recordCost(cost: number): Promise<void> {
  const db = getDb()
  await ensureDoc()
  await updateDoc(doc(db, BUDGET_DOC), {
    dailyUsed: increment(cost),
    monthlyUsed: increment(cost),
  })
}

export async function getBudgetConfig(): Promise<BudgetConfig> {
  const db = getDb()
  const snap = await getDoc(doc(db, BUDGET_DOC))
  const data = snap.data() ?? {}
  return {
    dailyCap: (data.dailyCap as number) ?? DEFAULT_BUDGET.dailyCap,
    monthlyCap: (data.monthlyCap as number) ?? DEFAULT_BUDGET.monthlyCap,
    enabled: (data.enabled as boolean) ?? true,
    pauseOnExceed: true,
  }
}

export async function updateBudgetConfig(partial: Partial<BudgetConfig>): Promise<void> {
  const db = getDb()
  await ensureDoc()
  await updateDoc(doc(db, BUDGET_DOC), partial as Record<string, unknown>)
}
