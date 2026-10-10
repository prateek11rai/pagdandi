import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resend } from "resend";
import { env } from "./env";
import type { Mailer } from "./subscriptions";

// dry-run: write each email to .data/outbox/ (gitignored) instead of sending. Nothing is logged.
export function mailer(): Mailer {
  const e = env();
  if (e.EMAIL_MODE === "dry-run") {
    return {
      async send(m) {
        const dir = path.join(process.cwd(), ".data", "outbox");
        mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
        writeFileSync(file, `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}`);
      },
    };
  }
  const resend = new Resend(e.RESEND_API_KEY);
  return {
    async send(m) {
      const { error } = await resend.emails.send({
        from: e.EMAIL_FROM,
        to: m.to,
        subject: m.subject,
        text: m.text,
        html: m.html,
        headers: m.headers,
      });
      if (error) throw new Error(`Email send failed: ${error.name}`);
    },
  };
}
