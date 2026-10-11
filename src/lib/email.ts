import "server-only";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { addressIn, env } from "./env";
import type { Mailer } from "./subscriptions";

type Message = Parameters<Mailer["send"]>[0];

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  adminEmail: string;
}

interface Transport {
  sendMail(m: ReturnType<typeof smtpMessage>): Promise<unknown>; // nodemailer resolves with { response: "250 …" }
}

export function mailer(): Mailer {
  const e = env();
  if (e.EMAIL_MODE === "dry-run") return dryRunMailer(path.join(process.cwd(), ".data", "outbox"));
  return smtpMailer({
    host: e.SMTP_HOST!,
    port: e.SMTP_PORT,
    user: e.SMTP_USER!,
    pass: e.SMTP_PASS!,
    from: e.EMAIL_FROM ?? e.SMTP_USER!,
    adminEmail: e.ADMIN_EMAIL,
  });
}

// dry-run: write each email to a folder (.data/outbox/, gitignored) instead of sending, as .txt and .html. Nothing
// is logged.
export function dryRunMailer(dir: string): Mailer {
  return {
    async send(m) {
      mkdirSync(dir, { recursive: true });
      const base = path.join(dir, new Date().toISOString().replace(/[:.]/g, "-"));
      writeFileSync(`${base}.txt`, `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}`);
      writeFileSync(`${base}.html`, m.html);
    },
  };
}

// 587 upgrades with STARTTLS (and refuses to go on without it); 465 is TLS from the start.
export function smtpTransportOptions(c: Pick<SmtpConfig, "host" | "port" | "user" | "pass">) {
  return { host: c.host, port: c.port, secure: c.port === 465, requireTLS: c.port !== 465, auth: { user: c.user, pass: c.pass } };
}

// From reads "Pagdandi" <address>, whatever display name EMAIL_FROM had. Text and HTML go as multipart/alternative.
export function smtpMessage(c: Pick<SmtpConfig, "from">, m: Message) {
  return { from: { name: "Pagdandi", address: addressIn(c.from) }, to: m.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers };
}

const same = (a: string, b: string) => addressIn(a).toLowerCase() === addressIn(b).toLowerCase();

// "250 2.0.0 OK 1697040000 a1b2c3 - gsmtp" -> "250". The rest (queue and message IDs) is never logged.
export function replyCode(info: unknown): string | null {
  const response = (info as { response?: unknown } | null)?.response;
  return typeof response === "string" ? (/^([2-5]\d\d)\b/.exec(response)?.[1] ?? null) : null;
}

// The admin's own mailbox, sending only to the admin until there's a domain. Errors carry a code, never the
// server, the login or the address. A sent email logs only the server's 3-digit reply code.
export function smtpMailer(c: SmtpConfig, transport: Transport = nodemailer.createTransport(smtpTransportOptions(c))): Mailer {
  return {
    async send(m) {
      if (!same(m.to, c.adminEmail)) throw new Error("Refusing to email anyone but the admin until there's a domain.");
      let info: unknown;
      try {
        info = await transport.sendMail(smtpMessage(c, m));
      } catch (err) {
        const code = (err as { code?: unknown }).code;
        throw new Error(`Email send failed (${typeof code === "string" ? code : "SMTP error"})`);
      }
      console.log(`Email sent: SMTP ${replyCode(info) ?? "reply had no code"}`);
    },
  };
}
