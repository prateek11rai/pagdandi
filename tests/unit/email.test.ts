import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dryRunMailer, smtpMailer, smtpTransportOptions } from "@/lib/email";

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
      { from: "admin@example.com", to: "admin@example.com", subject: message.subject, text: message.text, html: message.html, headers: message.headers },
    ]);
  });

  it("uses EMAIL_FROM when it's set", async () => {
    const t = fakeTransport();
    await smtpMailer({ ...config, from: "Pagdandi <admin@example.com>" }, t).send(message);
    expect((t.sent[0] as { from: string }).from).toBe("Pagdandi <admin@example.com>");
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

  it("writes the email to the outbox folder instead of sending it", async () => {
    dir = mkdtempSync(path.join(tmpdir(), "outbox-"));
    await dryRunMailer(dir).send(message);
    const [file] = readdirSync(dir);
    expect(readFileSync(path.join(dir, file!), "utf8")).toBe(`To: admin@example.com\nSubject: ${message.subject}\n\n${message.text}`);
  });
});
