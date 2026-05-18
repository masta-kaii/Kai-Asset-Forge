"use server"

import { collection, addDoc, getDocs, query, orderBy, limit, where } from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"
import type { CostEntry } from "@/lib/budget/types"

const COLLECTION = "ledger"

export async function writeEntry(data: Omit<CostEntry, "id" | "createdAt">): Promise<CostEntry> {
  const db = getDb()
  const now = new Date().toISOString()
  const docRef = await addDoc(collection(db, COLLECTION), { ...data, createdAt: now })
  return { id: docRef.id, ...data, createdAt: now }
}

export async function getRecentEntries(count = 50): Promise<CostEntry[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(count))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CostEntry))
}

export async function getEntriesSince(since: string): Promise<CostEntry[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), where("createdAt", ">=", since), orderBy("createdAt", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CostEntry))
}
