import { NextResponse } from "next/server"
import { verifyCronAuth } from "@/lib/cron-auth"
import {
  buildMastaDigest,
  persistMastaDigest,
  postDigestToOperatorChat,
} from "@/app/actions/digest"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Daily Masta digest: snapshot of the last 24h. Always persists to
 * masta_digests. If MASTA_OPERATOR_UID is set, also drops the digest
 * as an assistant message in that operator's Masta chat thread.
 */
export async function GET(request: Request) {
  const auth = verifyCronAuth(request)
  if (auth) return auth

  try {
    const digest = await buildMastaDigest()
    const { digestId } = await persistMastaDigest(digest)
    const post = await postDigestToOperatorChat(digest)
    return NextResponse.json({
      ok: true,
      digestId,
      posted: post.posted,
      reason: post.reason,
      body: digest.body,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "digest failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
