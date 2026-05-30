import "server-only";

/**
 * Best-effort Telegram notifier for factory alerts.
 *
 * Env-gated: if TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are unset, this is a
 * no-op (returns false) so the app runs fine without alerting configured.
 * Never throws — alerting must not break the code path that triggers it.
 *
 * This is the same Telegram channel Kai already uses to talk to Hermes, so
 * unattended failures/staleness reach a phone instead of relying on someone
 * having the dashboard open.
 */
export async function notify(
  text: string,
  opts: { silent?: boolean } = {},
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chat,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        disable_notification: !!opts.silent,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
