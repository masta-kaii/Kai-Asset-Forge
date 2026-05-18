import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  limit as fbLimit,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore"
import { getDb } from "@/lib/firebase/client"

export interface StoredMastaMessage {
  id: string
  role: "user" | "assistant"
  content: string
  toolEvents?: { name: string; ms: number }[]
  createdAt: string
}

function path(userId: string) {
  return collection(getDb(), "masta_chats", userId, "messages")
}

export async function appendMessage(
  userId: string,
  msg: Omit<StoredMastaMessage, "id" | "createdAt">,
): Promise<string> {
  const ref = await addDoc(path(userId), {
    role: msg.role,
    content: msg.content,
    toolEvents: msg.toolEvents ?? [],
    createdAt: Timestamp.now(),
  })
  return ref.id
}

export async function loadMessages(userId: string, limit = 100): Promise<StoredMastaMessage[]> {
  const snap = await getDocs(query(path(userId), orderBy("createdAt", "asc"), fbLimit(limit)))
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>
    const ts = data.createdAt as Timestamp | undefined
    return {
      id: d.id,
      role: (data.role as "user" | "assistant") ?? "user",
      content: (data.content as string) ?? "",
      toolEvents: (data.toolEvents as { name: string; ms: number }[] | undefined) ?? [],
      createdAt: ts?.toDate().toISOString() ?? new Date().toISOString(),
    }
  })
}

export async function clearMessages(userId: string): Promise<void> {
  const snap = await getDocs(path(userId))
  await Promise.all(snap.docs.map((d) => deleteDoc(doc(getDb(), "masta_chats", userId, "messages", d.id))))
}
