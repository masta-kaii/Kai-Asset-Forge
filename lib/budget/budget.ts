import { doc, runTransaction, getDoc, Timestamp } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import { DEFAULT_BUDGET, type BudgetConfig, type BudgetStatus } from "./types"

/**
 * Budget tracking — persisted to Firestore under budget/state with atomic
 * counters so multiple Vercel instances (and Hermes containers hitting the
 * API in parallel) can't lose writes.
 *
 * The previous in-memory implementation reset on every cold start and
 * diverged across instances. recordCost() now uses runTransaction() so
 * concurrent +N writes accumulate correctly; getBudgetStatus() applies
 * day/month rollover in the read so the doc only resets on the next
 * recordCost() (cheap, no extra round-trip just to reset zero counters).
 */

const COLLECTION = "budget"
const DOC = "state"
const CACHE_TTL_MS = 3000

interface BudgetDoc {
  dailyUsed: number
  monthlyUsed: number
  /** toDateString() of the day this dailyUsed reflects. */
  dailyResetDate: string
  /** "YYYY-MM" of the month this monthlyUsed reflects. */
  monthlyResetKey: string
  dailyCap: number
  monthlyCap: number
  enabled: boolean
}

let cached: { doc: BudgetDoc; at: number } | null = null

function todayKey(): { day: string; month: string } {
  const d = new Date()
  return {
    day: d.toDateString(),
    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  }
}

function defaultsDoc(): BudgetDoc {
  const { day, month } = todayKey()
  return {
    dailyUsed: 0,
    monthlyUsed: 0,
    dailyResetDate: day,
    monthlyResetKey: month,
    dailyCap: DEFAULT_BUDGET.dailyCap,
    monthlyCap: DEFAULT_BUDGET.monthlyCap,
    enabled: DEFAULT_BUDGET.enabled,
  }
}

/** Apply day/month rollover on read — does not persist (next recordCost will). */
function rollover(b: BudgetDoc): BudgetDoc {
  const { day, month } = todayKey()
  let next = b
  if (b.dailyResetDate !== day) next = { ...next, dailyUsed: 0, dailyResetDate: day }
  if (b.monthlyResetKey !== month) next = { ...next, monthlyUsed: 0, monthlyResetKey: month }
  return next
}

async function readDoc(): Promise<BudgetDoc> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.doc
  try {
    const snap = await getDoc(doc(getDb(), COLLECTION, DOC))
    const data = snap.exists() ? ({ ...defaultsDoc(), ...(snap.data() as Partial<BudgetDoc>) }) : defaultsDoc()
    cached = { doc: data, at: Date.now() }
    return data
  } catch (err) {
    console.error("budget readDoc failed:", err)
    // Fail safe — return defaults so guards don't accidentally block all writes.
    return cached?.doc ?? defaultsDoc()
  }
}

function toStatus(b: BudgetDoc): BudgetStatus {
  const rolled = rollover(b)
  const dailyRemaining = Math.max(0, rolled.dailyCap - rolled.dailyUsed)
  const monthlyRemaining = Math.max(0, rolled.monthlyCap - rolled.monthlyUsed)
  return {
    dailyUsed: Math.round(rolled.dailyUsed * 10000) / 10000,
    monthlyUsed: Math.round(rolled.monthlyUsed * 10000) / 10000,
    dailyRemaining: Math.round(dailyRemaining * 10000) / 10000,
    monthlyRemaining: Math.round(monthlyRemaining * 10000) / 10000,
    dailyCap: rolled.dailyCap,
    monthlyCap: rolled.monthlyCap,
    dailyPercent: rolled.dailyCap > 0 ? Math.round((rolled.dailyUsed / rolled.dailyCap) * 100) : 0,
    monthlyPercent: rolled.monthlyCap > 0 ? Math.round((rolled.monthlyUsed / rolled.monthlyCap) * 100) : 0,
    isExceeded: dailyRemaining <= 0 || monthlyRemaining <= 0,
    lastResetDaily: rolled.dailyResetDate,
    lastResetMonthly: rolled.monthlyResetKey,
  }
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  return toStatus(await readDoc())
}

export async function canProceed(estimatedCost: number): Promise<{ allowed: boolean; reason?: string }> {
  const b = await readDoc()
  if (!b.enabled) return { allowed: true }
  const status = toStatus(b)
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

/**
 * Atomically add `cost` (USD) to today's + this-month's totals. Day/month
 * rollover is applied inside the transaction so a write right after midnight
 * persists the new bucket. Safe under concurrent writers.
 */
export async function recordCost(cost: number): Promise<void> {
  if (!Number.isFinite(cost) || cost <= 0) return
  const ref = doc(getDb(), COLLECTION, DOC)
  const { day, month } = todayKey()
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref)
      const current: BudgetDoc = snap.exists()
        ? { ...defaultsDoc(), ...(snap.data() as Partial<BudgetDoc>) }
        : defaultsDoc()
      const dailyUsed = current.dailyResetDate === day ? current.dailyUsed + cost : cost
      const monthlyUsed = current.monthlyResetKey === month ? current.monthlyUsed + cost : cost
      const next: BudgetDoc & { updatedAt: Timestamp } = {
        ...current,
        dailyUsed,
        monthlyUsed,
        dailyResetDate: day,
        monthlyResetKey: month,
        updatedAt: Timestamp.now(),
      }
      tx.set(ref, next, { merge: true })
    })
    // Invalidate cache so the very next read reflects this write.
    cached = null
  } catch (err) {
    console.error("budget recordCost transaction failed:", err)
  }
}

export async function updateBudgetConfig(partial: Partial<BudgetConfig>): Promise<void> {
  const ref = doc(getDb(), COLLECTION, DOC)
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref)
      const current: BudgetDoc = snap.exists()
        ? { ...defaultsDoc(), ...(snap.data() as Partial<BudgetDoc>) }
        : defaultsDoc()
      const next: BudgetDoc & { updatedAt: Timestamp } = {
        ...current,
        ...(partial.dailyCap !== undefined ? { dailyCap: partial.dailyCap } : {}),
        ...(partial.monthlyCap !== undefined ? { monthlyCap: partial.monthlyCap } : {}),
        ...(partial.enabled !== undefined ? { enabled: partial.enabled } : {}),
        updatedAt: Timestamp.now(),
      }
      tx.set(ref, next, { merge: true })
    })
    cached = null
  } catch (err) {
    console.error("budget updateBudgetConfig failed:", err)
  }
}

export async function resetDaily(): Promise<void> {
  const ref = doc(getDb(), COLLECTION, DOC)
  const { day } = todayKey()
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref)
      const current: BudgetDoc = snap.exists()
        ? { ...defaultsDoc(), ...(snap.data() as Partial<BudgetDoc>) }
        : defaultsDoc()
      tx.set(ref, { ...current, dailyUsed: 0, dailyResetDate: day, updatedAt: Timestamp.now() }, { merge: true })
    })
    cached = null
  } catch (err) {
    console.error("budget resetDaily failed:", err)
  }
}
