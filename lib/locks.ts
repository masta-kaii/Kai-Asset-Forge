import { doc, runTransaction, deleteDoc, Timestamp } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"

/**
 * Tiny Firestore-backed advisory lock. One holder at a time per `name`,
 * with a TTL so a crashed holder doesn't wedge the system forever.
 *
 * Use case: prevent two concurrent orchestrator runs (cron + manual click,
 * cron + Hermes container, two Hermes containers) from corrupting the
 * pipeline's resume state or double-charging the budget.
 *
 * Not a true mutex — Firestore can't guarantee monotonic time, and the
 * TTL is best-effort. Good enough to stop the obvious races we have today.
 */

const COLLECTION = "locks"

export interface LockHandle {
  name: string
  acquiredAt: number
  ttlMs: number
  /** Random token written into the doc so releaseLock() only deletes if we're still the holder. */
  token: string
}

interface LockDoc {
  acquiredAt: number
  ttlMs: number
  token: string
}

function newToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Try to take the lock. Returns null if another holder is still within TTL.
 */
export async function acquireLock(
  name: string,
  ttlMs: number = 15 * 60 * 1000,
): Promise<LockHandle | null> {
  const ref = doc(getDb(), COLLECTION, name)
  const now = Date.now()
  const token = newToken()
  try {
    const got = await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref)
      if (snap.exists()) {
        const data = snap.data() as LockDoc
        if (now < data.acquiredAt + data.ttlMs) return false
      }
      tx.set(ref, {
        acquiredAt: now,
        ttlMs,
        token,
        updatedAt: Timestamp.now(),
      } satisfies LockDoc & { updatedAt: Timestamp })
      return true
    })
    if (!got) return null
    return { name, acquiredAt: now, ttlMs, token }
  } catch (err) {
    console.error(`acquireLock(${name}) failed:`, err)
    return null
  }
}

/**
 * Release the lock IF we're still the holder (token match). If the TTL
 * already expired and someone else acquired it, we leave their lock alone.
 */
export async function releaseLock(handle: LockHandle): Promise<void> {
  const ref = doc(getDb(), COLLECTION, handle.name)
  try {
    await runTransaction(getDb(), async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists()) return
      const data = snap.data() as LockDoc
      if (data.token === handle.token) tx.delete(ref)
    })
  } catch (err) {
    // Best-effort — fall back to a blind delete so a transient transaction
    // failure doesn't leave the lock orphaned for its full TTL.
    console.error(`releaseLock(${handle.name}) transaction failed, attempting blind delete:`, err)
    try {
      await deleteDoc(ref)
    } catch {}
  }
}

export type WithLockResult<T> =
  | { locked: false; result: T }
  | { locked: true; heldFor: number }

/**
 * Run `fn` while holding the lock. If the lock is held by someone else,
 * returns `{ locked: true, heldFor }` (ms remaining on the current holder's TTL)
 * without calling `fn`.
 */
export async function withLock<T>(
  name: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<WithLockResult<T>> {
  const handle = await acquireLock(name, ttlMs)
  if (!handle) {
    return { locked: true, heldFor: ttlMs }
  }
  try {
    const result = await fn()
    return { locked: false, result }
  } finally {
    await releaseLock(handle)
  }
}
