import "server-only"

import { collection, addDoc, getDocs, query, orderBy, limit, doc, updateDoc } from "firebase/firestore"
import { getDb } from "./client"
import type { Workflow } from "@/lib/types"

const COLLECTION = "workflows"

export async function createWorkflow(data: Omit<Workflow, "id" | "createdAt">): Promise<Workflow> {
  const db = getDb()
  const now = new Date().toISOString()
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    createdAt: now,
  })
  return { id: docRef.id, ...data, createdAt: now }
}

export async function getRecentWorkflows(count = 10): Promise<Workflow[]> {
  const db = getDb()
  const q = query(collection(db, COLLECTION), orderBy("createdAt", "desc"), limit(count))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Workflow))
}

export async function getActiveWorkflows(): Promise<Workflow[]> {
  const db = getDb()
  const snapshot = await getDocs(collection(db, COLLECTION))
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as Workflow))
    .filter((w) => w.status === "running" || w.status === "pending")
}

export async function updateWorkflowStatus(
  workflowId: string,
  status: Workflow["status"],
  completedAt?: string
): Promise<void> {
  const db = getDb()
  const ref = doc(db, COLLECTION, workflowId)
  const data: Record<string, unknown> = { status }
  if (completedAt) data.completedAt = completedAt
  await updateDoc(ref, data)
}
