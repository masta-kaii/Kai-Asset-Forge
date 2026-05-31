import "server-only";
import { NextRequest } from "next/server";

/**
 * Shared bearer-token check for write/telemetry endpoints.
 *
 * Reuses STATUS_PUSH_SECRET — the same secret the PC-side status pusher and
 * the Hermes fleet already hold. When the secret is unset (local dev), the
 * check is a no-op so the dashboard keeps working without configuration.
 *
 * Returns null when authorized, or a short reason string when rejected.
 */
let warnedOpen = false;

export function checkPushSecret(req: NextRequest): string | null {
  const secret = process.env.STATUS_PUSH_SECRET;
  if (!secret || secret.length === 0) {
    // Fail-open is intended only for local dev. In production this means
    // anyone can write to the ledger (admin SDK bypasses firestore.rules),
    // so make the misconfiguration loud rather than silent.
    if (!warnedOpen && process.env.NODE_ENV === "production") {
      warnedOpen = true;
      console.error(
        "SECURITY: STATUS_PUSH_SECRET is unset in production — run/budget/event " +
          "write endpoints are accepting UNAUTHENTICATED writes. Set it now.",
      );
    }
    return null; // unconfigured → allow
  }

  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
  if (token !== secret) return "Unauthorized";
  return null;
}
