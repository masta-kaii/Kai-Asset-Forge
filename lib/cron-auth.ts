/**
 * Vercel cron sends `Authorization: Bearer <CRON_SECRET>` to scheduled
 * endpoints when CRON_SECRET is set as an env var on the project. We
 * verify it here. In non-production environments the check is skipped so
 * the endpoints can be hit manually from a browser or curl.
 *
 * Returns null on success, or a Response (401) to return immediately.
 */
export function verifyCronAuth(request: Request): Response | null {
  if (process.env.NODE_ENV !== "production") return null

  const secret = process.env.CRON_SECRET
  if (!secret) {
    // No secret configured — refuse rather than silently allow.
    return new Response("CRON_SECRET not configured", { status: 500 })
  }

  const header = request.headers.get("authorization")
  if (header !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  return null
}
