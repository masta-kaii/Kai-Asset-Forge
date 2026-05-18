import { doc, getDoc, setDoc } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"

const DOC = "config/killswitch"

export async function isPaused(): Promise<boolean> {
  try {
    const db = getDb()
    const snap = await getDoc(doc(db, DOC))
    return (snap.data()?.paused as boolean) ?? false
  } catch {
    return false
  }
}

export async function pause(): Promise<void> {
  const db = getDb()
  await setDoc(doc(db, DOC), {
    paused: true,
    pausedAt: new Date().toISOString(),
    pausedBy: "operator",
  })
}

export async function resume(): Promise<void> {
  const db = getDb()
  await setDoc(doc(db, DOC), {
    paused: false,
    resumedAt: new Date().toISOString(),
  })
}
