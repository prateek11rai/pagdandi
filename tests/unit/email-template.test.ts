import { describe, expect, it } from "vitest";
import { confirmationEmail, digestEmail, type DigestContent, type Email } from "@/lib/email-template";

// Synthetic values only: nothing here comes from .env.
const SITE = "https://pagdandi.example";
const trek = { name: "Valley of Flowers", state: "Uttarakhand", slug: "valley-of-flowers" };
const digest: DigestContent = {
  siteUrl: SITE,
  trek,
  togo: "14 days to go",
  travelDate: "2026-10-25",
  status: "all clear so far",
  forecast: [
    { label: "Road head", place: "Govindghat, 1,828 m", days: ["Sun, 11 Oct: Rain, 9 to 18 °C, 3 mm rain", "Mon, 12 Oct: Overcast, 8 to 16 °C"] },
    { label: "High point (estimate)", place: "Valley of Flowers, 3,658 m", days: ["Sun, 11 Oct: Snow, -2 to 5 °C, 4 cm snow"] },
  ],
  forecastSample: false,
  news: [
    { text: 'Bridge <script>alert("x")</script> & road reopen', source: "Times & <b>Co</b>", date: "Sat, 10 Oct", url: "https://news.example/story?id=1&ref=feed" },
    { text: "A link that isn't https", source: null, date: null, url: "javascript:alert(1)" },
  ],
  newsNote: null,
  newsSample: false,
  prep: "Walk 8 km today with a day pack carrying 4 to 5 kg.",
  unsubscribeUrl: `${SITE}/api/unsubscribe?token=abc_DEF-123`,
};
const confirm = { siteUrl: SITE, trek, travelDate: "2026-10-25", confirmUrl: `${SITE}/api/confirm?token=c0nf`, unsubscribeUrl: `${SITE}/api/unsubscribe?token=uns` };

// What a reader sees in the HTML, as words: tags dropped, entities decoded, the hidden preheader kept out.
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
function visibleWords(html: string): string {
  const body = html.replace(/<div style="display:none[^>]*>[\s\S]*?<\/div>/, "").replace(/<head>[\s\S]*?<\/head>/, "");
  const decoded = body
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
  return ` ${words(decoded).join(" ")} `;
}

// Every line of the text part, minus its URLs, appears in the HTML as the same run of words.
function textMatchesHtml(m: Email) {
  const shown = visibleWords(m.html);
  for (const line of m.text.split("\n")) {
    const w = words(line.replace(/https?:\/\/\S+/g, ""));
    if (w.length > 0) expect(shown, `text line: ${line}`).toContain(` ${w.join(" ")} `);
  }
}

// No <style> block, images, web fonts or tracking; every URL is on the site, or is a news article's own link.
function selfContained(m: Email) {
  expect(m.html).not.toMatch(/<style|<img|<link|<script|url\(|data:|@import|@font-face|javascript:/i);
  for (const url of m.html.match(/https?:\/\/[^"'\s<)]+/g) ?? []) expect(url.startsWith(SITE) || url.startsWith("https://news.example/"), url).toBe(true);
  expect(m.html).toContain("max-width:600px");
}

describe("email template", () => {
  it("escapes headlines and sources in the HTML, and keeps them readable in the text", () => {
    const m = digestEmail(digest);
    expect(m.html).toContain(
      '<a href="https://news.example/story?id=1&amp;ref=feed" rel="noopener noreferrer" style="color:#1f2a24;text-decoration:underline">Bridge &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; road reopen</a>',
    );
    expect(m.html).toContain("Times &amp; &lt;b&gt;Co&lt;/b&gt; · Sat, 10 Oct");
    expect(m.html).not.toMatch(/<script|<b>Co/);
    expect(m.text).toContain('- Bridge <script>alert("x")</script> & road reopen\n  Times & <b>Co</b> · Sat, 10 Oct\n  https://news.example/story?id=1&ref=feed');
  });

  it("links each headline to its article only when the link is https", () => {
    const m = digestEmail(digest);
    expect(m.html).toContain(">A link that isn&#39;t https</p>");
    expect(m.text).not.toContain("javascript:");
    expect(m.html.match(/rel="noopener noreferrer"/g)).toHaveLength(1);
  });

  it("has a text part with the same content as the HTML", () => {
    for (const m of [
      digestEmail(digest),
      digestEmail({ ...digest, forecast: null, news: [], newsNote: "News check skipped today: our search budget is used up." }),
      digestEmail({ ...digest, forecastSample: true, newsSample: true, news: [] }),
      confirmationEmail(confirm),
    ]) {
      expect(m.text.length).toBeGreaterThan(200);
      textMatchesHtml(m);
    }
  });

  it("puts the brand first in both subjects", () => {
    expect(digestEmail(digest).subject).toBe("Pagdandi · Valley of Flowers · 14 days to go · all clear so far");
    expect(digestEmail({ ...digest, forecastSample: true }).subject).toBe("Pagdandi · Valley of Flowers · 14 days to go · all clear so far · SAMPLE DATA");
    expect(confirmationEmail(confirm).subject).toBe("Pagdandi · Confirm daily updates for Valley of Flowers");
  });

  it("is self-contained: inline styles, no images or web fonts, links only to the site", () => {
    for (const m of [digestEmail(digest), confirmationEmail(confirm)]) {
      selfContained(m);
      expect(m.html).toContain('<span lang="hi" style="font-family:\'Anek Devanagari\', Helvetica, Arial, sans-serif;font-size:19px;line-height:1;font-weight:600;color:#c2643b">पगडंडी</span>');
      expect(m.html).toContain("Eczar, Georgia, 'Times New Roman', serif");
    }
  });

  it("carries the digest's parts in order, and the confirmation's button and plain link", () => {
    const visible = (html: string) => html.slice(html.indexOf("</div>"));
    const d = visible(digestEmail(digest).html);
    const order = ["Daily update", "Valley of Flowers", "14 days to go", "Forecast", "Road head", "High point (estimate)", "News since yesterday", "One thing to do outside today", "You get this once a day at 7:00 IST until Sun, 25 Oct 2026.", "Stop these emails", "Pagdandi · India&#39;s open trek database", "Open-Meteo.com", "OpenStreetMap"];
    const at = order.map((s) => d.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(digestEmail({ ...digest, news: [] }).html).toContain("Nothing new.");

    const c = confirmationEmail(confirm).html;
    expect(c).toMatch(/<td style="background:#3f6b4f;border-radius:8px"><a href="https:\/\/pagdandi\.example\/api\/confirm\?token=c0nf"[^>]*>Confirm daily updates<\/a><\/td>/);
    expect(c).toContain(">https://pagdandi.example/api/confirm?token=c0nf</a>");
    expect(c).not.toContain("<button");
  });
});
