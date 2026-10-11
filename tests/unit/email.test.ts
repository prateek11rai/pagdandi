import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { dryRunMailer, replyCode, smtpMailer, smtpTransportOptions } from "@/lib/email";
import { unsubscribeHeaders } from "@/lib/subscriptions";

const config = {
  host: "smtp.example.com",
  port: 587,
  user: "admin@example.com",
  pass: "not-a-real-password",
  from: "admin@example.com",
  adminEmail: "Admin@Example.com",
};
const message = {
  to: "admin@example.com",
  subject: "Kedarkantha · 12 days to go · all clear so far",
  text: "FORECAST\n…",
  html: "<p>FORECAST</p>",
  headers: { "List-Unsubscribe": "<https://example.org/api/unsubscribe?token=t>" },
};

function fakeTransport(fail?: Error) {
  const sent: unknown[] = [];
  return {
    sent,
    async sendMail(m: unknown) {
      if (fail) throw fail;
      sent.push(m);
    },
  };
}

describe("SMTP email", () => {
  it("sends the admin's message from the admin's mailbox, with the unsubscribe headers", async () => {
    const t = fakeTransport();
    await smtpMailer(config, t).send(message);
    expect(t.sent).toEqual([
      {
        from: { name: "Pagdandi", address: "admin@example.com" },
        to: "admin@example.com",
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: message.headers,
      },
    ]);
  });

  it("uses EMAIL_FROM's address when it's set, always with Pagdandi as the name", async () => {
    const t = fakeTransport();
    await smtpMailer({ ...config, from: "Someone Else <updates@example.com>" }, t).send(message);
    expect((t.sent[0] as { from: unknown }).from).toEqual({ name: "Pagdandi", address: "updates@example.com" });
  });

  // nodemailer's stream transport builds the real message without a network: what a mail client receives.
  it("goes out as multipart/alternative, from \"Pagdandi\", with both unsubscribe headers", async () => {
    const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" });
    let raw = "";
    await smtpMailer(config, { sendMail: async (m) => void (raw = String(((await stream.sendMail(m)) as { message: Buffer }).message)) }).send({
      ...message,
      headers: unsubscribeHeaders("https://example.org/api/unsubscribe?token=t"),
    });
    expect(raw).toMatch(/^From: Pagdandi <admin@example\.com>$/m);
    expect(raw).toMatch(/^Content-Type: multipart\/alternative;/m);
    expect(raw).toMatch(/^Content-Type: text\/plain; charset=utf-8$/m);
    expect(raw).toMatch(/^Content-Type: text\/html; charset=utf-8$/m);
    expect(raw).toMatch(/^List-Unsubscribe: <https:\/\/example\.org\/api\/unsubscribe\?token=t>$/m);
    expect(raw).toMatch(/^List-Unsubscribe-Post: List-Unsubscribe=One-Click$/m);
  });

  it("logs only the server's 3-digit reply code", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const reply = { sendMail: async () => ({ response: "250 2.0.0 OK  1697040000 a1b2c3d4e5-gsmtp", messageId: "<x@example.com>", accepted: ["admin@example.com"] }) };
    await smtpMailer(config, reply).send(message);
    expect(log.mock.calls).toEqual([["Email sent: SMTP 250"]]);
    log.mockRestore();
    expect(replyCode({ response: "421 4.7.0 Try again later" })).toBe("421");
    expect(replyCode({ response: "OK" })).toBeNull();
    expect(replyCode(undefined)).toBeNull();
  });

  it("refuses any recipient but the admin, before touching the server", async () => {
    const t = fakeTransport();
    await expect(smtpMailer(config, t).send({ ...message, to: "friend@example.org" })).rejects.toThrow(/anyone but the admin/);
    expect(t.sent).toEqual([]);
  });

  it("reports failures by code only, never the server or the login", async () => {
    const err = Object.assign(new Error("Invalid login for admin@example.com at smtp.example.com:587"), { code: "EAUTH" });
    const failure = smtpMailer(config, fakeTransport(err)).send(message);
    await expect(failure).rejects.toThrow("Email send failed (EAUTH)");
    await expect(failure).rejects.not.toThrow(/example\.com|admin@/);
  });

  it("uses STARTTLS on 587 and implicit TLS on 465", () => {
    expect(smtpTransportOptions(config)).toMatchObject({ port: 587, secure: false, requireTLS: true });
    expect(smtpTransportOptions({ ...config, port: 465 })).toMatchObject({ port: 465, secure: true, requireTLS: false });
  });
});

describe("dry-run email", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("writes the email to the outbox folder instead of sending it, as text and HTML", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "outbox-"));
    await dryRunMailer(dir).send(message);
    const files = readdirSync(dir).sort();
    expect(files.map((f) => path.extname(f))).toEqual([".html", ".txt"]);
    expect(readFileSync(path.join(dir, files[1]!), "utf8")).toBe(`To: admin@example.com\nSubject: ${message.subject}\n\n${message.text}`);
    expect(readFileSync(path.join(dir, files[0]!), "utf8")).toBe(message.html);
  });
});
