"use server"

import { doc, setDoc, deleteDoc, getDoc, Timestamp } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"

const LOCKS = "config/locks"

// Acquire a lock with automatic expiry (30 minutes)
export async function acquireLock(name: string): Promise<boolean> {
  const db = getDb()
  const ref = doc(db, LOCKS, name)
  try {
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const data = snap.data()
      const lockedAt = data.lockedAt as Timestamp
      const now = Date.now()
      // Expire locks older than 30 minutes (stale lock from crashed container)
      if (now - lockedAt.toMillis() < 30 * 60 * 1000) {
        return false // Lock is still held
      }
    }
    await setDoc(ref, {
      name,
      lockedAt: Timestamp.now(),
      owner: "orchestrator",
    })
    return true
  } catch {
    return false
  }
}

export async function releaseLock(name: string): Promise<void> {
  const db = getDb()
  try {
    await deleteDoc(doc(db, LOCKS, name))
  } catch {}
}

export async function withLock<T>(name: string, fn: () => Promise<T>): Promise<{ acquired: boolean; result?: T }> {
  const acquired = await acquireLock(name)
  if (!acquired) return { acquired: false }
  try {
    const result = await fn()
    return { acquired: true, result }
  } finally {
    await releaseLock(name)
  }
}
