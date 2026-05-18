import { initializeApp, getApps } from "firebase/app"
import { getFirestore } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

export function getFirebaseApp() {
  try {
    if (getApps().length === 0) {
      return initializeApp(firebaseConfig)
    }
    return getApps()[0]
  } catch (error) {
    console.error("Firebase init failed:", error)
    throw new Error("Firebase initialization failed. Check NEXT_PUBLIC_FIREBASE_* env vars in Vercel.")
  }
}

let _db: ReturnType<typeof getFirestore> | null = null
export function getDb() {
  try {
    if (!_db) {
      _db = getFirestore(getFirebaseApp())
    }
    return _db
  } catch (error) {
    console.error("Firestore init failed:", error)
    throw new Error("Firestore initialization failed. Check Firebase config.")
  }
}

let _auth: ReturnType<typeof getAuth> | null = null
export function getFirebaseAuth() {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp())
  }
  return _auth
}

let _storage: ReturnType<typeof getStorage> | null = null
export function getFirebaseStorage() {
  if (!_storage) {
    _storage = getStorage(getFirebaseApp())
  }
  return _storage
}
