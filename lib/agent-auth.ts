/**
 * Bearer-token auth for the /api/agents/* endpoints that Hermes specialists
 * call from the VPS. The token is stored in Vercel as AGENT_API_TOKEN and
 * mirrored into each container's env-map.md.
 *
 * Distinct from CRON_SECRET so a leaked agent token doesn't grant cron
 * privileges (and vice versa). In non-production environments the check
 * is skipped so you can hit endpoints from curl while developing locally.
 *
 * Returns null on success, or a Response (401/500) to return immediately.
 */
export function verifyAgentAuth(request: Request): Response | null {
  if (process.env.NODE_ENV !== "production") return null

  const token = process.env.AGENT_API_TOKEN
  if (!token) {
    return new Response("AGENT_API_TOKEN not configured", { status: 500 })
  }

  const header = request.headers.get("authorization")
  if (header !== `Bearer ${token}`) {
    return new Response("Unauthorized", { status: 401 })
  }
  return null
}
