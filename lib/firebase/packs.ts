import "server-only"

import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore"
import { getDb } from "./client"
import type { AssetPack } from "@/lib/types"

const COLLECTION = "packs"

export async function createPack(data: Omit<AssetPack, "id" | "createdAt">): Promise<AssetPack> {
  const db = getDb()
  const now = new Date().toISOString()
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: now,
  })
  return { id: docRef.id, ...data, createdAt: now }
}

export async function getPacks(): Promise<AssetPack[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AssetPack))
}

export async function updatePackAssets(packId: string, assetIds: string[]): Promise<void> {
  const db = getDb()
  const ref = doc(db, COLLECTION, packId)
  await updateDoc(ref, { assets: assetIds })
}

export async function getReadyPacks(): Promise<number> {
  const db = getDb()
  const snapshot = await getDocs(collection(db, COLLECTION))
  return snapshot.docs.filter((d) => d.data().status === "approved").length
}
