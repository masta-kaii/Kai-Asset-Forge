import "server-only"

import { collection, addDoc, getDocs, query, orderBy, limit, where, doc, updateDoc } from "firebase/firestore"
import { getDb } from "./client"
import type { Asset, AssetStatus } from "@/lib/types"

const COLLECTION = "assets"

export async function createAsset(data: Omit<Asset, "id" | "createdAt" | "updatedAt">): Promise<Asset> {
  const db = getDb()
  const now = new Date().toISOString()
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: now,
    updatedAt: now,
  })
  return { id: docRef.id, ...data, createdAt: now, updatedAt: now }
}

export async function getRecentAssets(count = 12): Promise<Asset[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(count))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Asset))
}

export async function getAssetsByType(type: string, count = 20): Promise<Asset[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), where("type", "==", type), orderBy("createdAt", "desc"), limit(count))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Asset))
}

export async function getAssetsByStatus(status: string): Promise<Asset[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), where("status", "==", status), orderBy("createdAt", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Asset))
}

export async function getAssetCount(): Promise<number> {
  const db = getDb()
  const snapshot = await getDocs(collection(db, COLLECTION))
  return snapshot.size
}

export async function updateAssetStatus(assetId: string, status: AssetStatus): Promise<void> {
  const db = getDb()
  const ref = doc(db, COLLECTION, assetId)
  await updateDoc(ref, { status, updatedAt: new Date().toISOString() })
}
