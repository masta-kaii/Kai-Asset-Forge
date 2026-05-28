import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getDb() {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getFirestore(app);
}

export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    const snap = await getDoc(doc(db, "system", "pc-status"));
    if (!snap.exists()) {
      return NextResponse.json({ latest: null, ageSeconds: null });
    }
    const data = snap.data();
    const ageSeconds = Math.floor((Date.now() - data._ts) / 1000);
    return NextResponse.json({ latest: data, ageSeconds });
  } catch (e) {
    console.error("GET error:", e);
    return NextResponse.json({ latest: null, ageSeconds: null });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.STATUS_PUSH_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const db = getDb();
    await setDoc(doc(db, "system", "pc-status"), {
      ...body,
      _ts: Date.now(),
    });
    return NextResponse.json({ ok: true, receivedAt: new Date().toISOString() });
  } catch (e) {
    console.error("POST error:", e);
    return NextResponse.json({ error: "Storage error" }, { status: 500 });
  }
}
