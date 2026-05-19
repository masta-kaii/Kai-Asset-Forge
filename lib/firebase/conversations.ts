import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  getDoc,
} from "firebase/firestore"
import { getDb } from "./client"
import type { ChatAgentId } from "@/lib/agents/chat-personas"

export interface ChatMessage {
  id: string
  role: "user" | "agent"
  content: string
  createdAt: number
}

export interface Conversation {
  id: string
  agentId: ChatAgentId
  title: string
  provider: "deepseek" | "claude"
  messageCount: number
  createdAt: number
  updatedAt: number
}

interface FirestoreConversation {
  agentId: string
  title: string
  provider: string
  messageCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

interface FirestoreMessage {
  role: "user" | "agent"
  content: string
  createdAt: Timestamp
}

export async function createConversation(
  agentId: ChatAgentId,
  title: string,
  provider: "deepseek" | "claude",
): Promise<Conversation> {
  const db = getDb()
  const ref = await addDoc(collection(db, "conversations"), {
    agentId,
    title,
    provider,
    messageCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return {
    id: ref.id,
    agentId,
    title,
    provider,
    messageCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export async function getConversations(): Promise<Conversation[]> {
  const db = getDb()
  const q = query(
    collection(db, "conversations"),
    orderBy("updatedAt", "desc"),
    limit(50),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => {
    const data = d.data() as FirestoreConversation
    return {
      id: d.id,
      agentId: data.agentId as ChatAgentId,
      title: data.title,
      provider: data.provider as "deepseek" | "claude",
      messageCount: data.messageCount ?? 0,
      createdAt: data.createdAt?.toMillis() ?? Date.now(),
      updatedAt: data.updatedAt?.toMillis() ?? Date.now(),
    }
  })
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const db = getDb()
  const d = await getDoc(doc(db, "conversations", conversationId))
  if (!d.exists()) return null
  const data = d.data() as FirestoreConversation
  return {
    id: d.id,
    agentId: data.agentId as ChatAgentId,
    title: data.title,
    provider: data.provider as "deepseek" | "claude",
    messageCount: data.messageCount ?? 0,
    createdAt: data.createdAt?.toMillis() ?? Date.now(),
    updatedAt: data.updatedAt?.toMillis() ?? Date.now(),
  }
}

export async function getMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = getDb()
  const q = query(
    collection(db, "conversations", conversationId, "messages"),
    orderBy("createdAt", "asc"),
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => {
    const data = d.data() as FirestoreMessage
    return {
      id: d.id,
      role: data.role,
      content: data.content,
      createdAt: data.createdAt?.toMillis() ?? Date.now(),
    }
  })
}

export async function addMessage(
  conversationId: string,
  role: "user" | "agent",
  content: string,
): Promise<ChatMessage> {
  const db = getDb()
  const ref = await addDoc(collection(db, "conversations", conversationId, "messages"), {
    role,
    content,
    createdAt: serverTimestamp(),
  })

  const convRef = doc(db, "conversations", conversationId)
  const convSnap = await getDoc(convRef)
  const currentCount = convSnap.exists() ? (convSnap.data() as FirestoreConversation).messageCount ?? 0 : 0
  await updateDoc(convRef, {
    messageCount: currentCount + 1,
    updatedAt: serverTimestamp(),
  })

  return {
    id: ref.id,
    role,
    content,
    createdAt: Date.now(),
  }
}

export async function updateConversationTitle(conversationId: string, title: string): Promise<void> {
  const db = getDb()
  await updateDoc(doc(db, "conversations", conversationId), { title })
}

export async function deleteConversation(conversationId: string): Promise<void> {
  const db = getDb()
  const messagesSnap = await getDocs(collection(db, "conversations", conversationId, "messages"))
  const deletions = messagesSnap.docs.map((d) => deleteDoc(d.ref))
  await Promise.all(deletions)
  await deleteDoc(doc(db, "conversations", conversationId))
}
