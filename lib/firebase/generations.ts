import { collection, addDoc, getDocs, query, orderBy, limit, Timestamp } from "firebase/firestore"
import { getDb } from "./client"
import type { GenerationRecord } from "@/lib/types"

const COLLECTION = "generations"

export async function createGeneration(data: Omit<GenerationRecord, "id" | "createdAt">): Promise<GenerationRecord> {
  const db = getDb()
  const now = new Date().toISOString()
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: now,
  })
  return { id: docRef.id, ...data, createdAt: now }
}

export async function getRecentGenerations(count = 10): Promise<GenerationRecord[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(count))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as GenerationRecord))
}
