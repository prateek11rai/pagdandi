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
  sendMail(m: ReturnType<typeof smtpMessage>): Promise<unknown>;
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

// dry-run: write each email to a folder (.data/outbox/, gitignored) instead of sending. Nothing is logged.
export function dryRunMailer(dir: string): Mailer {
  return {
    async send(m) {
      mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.txt`);
      writeFileSync(file, `To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}`);
    },
  };
}

// 587 upgrades with STARTTLS (and refuses to go on without it); 465 is TLS from the start.
export function smtpTransportOptions(c: Pick<SmtpConfig, "host" | "port" | "user" | "pass">) {
  return { host: c.host, port: c.port, secure: c.port === 465, requireTLS: c.port !== 465, auth: { user: c.user, pass: c.pass } };
}

export function smtpMessage(c: Pick<SmtpConfig, "from">, m: Message) {
  return { from: c.from, to: m.to, subject: m.subject, text: m.text, html: m.html, headers: m.headers };
}

const same = (a: string, b: string) => addressIn(a).toLowerCase() === addressIn(b).toLowerCase();

// The admin's own mailbox, sending only to the admin until there's a domain. Errors carry a code, never the
// server, the login or the address.
export function smtpMailer(c: SmtpConfig, transport: Transport = nodemailer.createTransport(smtpTransportOptions(c))): Mailer {
  return {
    async send(m) {
      if (!same(m.to, c.adminEmail)) throw new Error("Refusing to email anyone but the admin until there's a domain.");
      try {
        await transport.sendMail(smtpMessage(c, m));
      } catch (err) {
        const code = (err as { code?: unknown }).code;
        throw new Error(`Email send failed (${typeof code === "string" ? code : "SMTP error"})`);
      }
    },
  };
}
