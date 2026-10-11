// Pagdandi's emails in the site's design language: table-based HTML with inline styles only (no <style> block, web
// fonts, images or tracking), and a plain-text part with the same content. Every interpolated string is escaped.
// Links go to the site, except each news headline, which links to its article (https only).

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
const e = escapeHtml;

// The site's palette (src/app/globals.css) as literal colours: email clients don't support CSS variables.
const P = {
  paper: "#f6f1e7",
  raised: "#fbf8f1",
  deep: "#ebe4d6",
  ink: "#1f2a24",
  muted: "#5a635c",
  moss: "#3f6b4f",
  mossStrong: "#2f533c",
  mossTint: "#e2e6dc", // moss at about 14% on paper-raised, for the countdown
  clay: "#c2643b",
  saffron: "#e8a33d",
  rule: "#d2cfc6", // ink at 18% on paper, as --rule
};
// Gmail won't load web fonts, so the fallbacks are what most readers see.
const HEADING = "Eczar, Georgia, 'Times New Roman', serif";
const BODY = "'Anek Devanagari', Helvetica, Arial, sans-serif";

const DATE = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const SHORT = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
// "Sun, 25 Oct 2026" (en-IN alone puts a comma before the year).
export function formatTravelDate(isoDate: string): string {
  const part = (type: string) => DATE.formatToParts(new Date(isoDate)).find((x) => x.type === type)?.value ?? "";
  return `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
}
export const formatShortDate = (iso: string) => SHORT.format(new Date(iso));

const BRAND_LINE = "Pagdandi · India's open trek database";
export const NO_NEWS = "No news. Everything looks good for your upcoming trek.";
const NOT_YOU = "Not you? Ignore this email and nothing happens.";

export interface ForecastRow {
  label: string; // "Road head" or "High point (estimate)"
  place: string; // "Govindghat, 1,828 m"
  days: string[]; // "Sun, 11 Oct: Rain, 9 to 18 °C, 3 mm rain"
}

export interface NewsLine {
  text: string;
  source: string | null;
  date: string | null; // already formatted
  url: string | null; // the article; linked only if it's https
}

export interface DigestContent {
  siteUrl: string;
  trek: { name: string; state: string; slug: string };
  togo: string; // "14 days to go"
  travelDate: string; // YYYY-MM-DD
  status: string; // the subject's one-liner
  forecast: ForecastRow[] | null; // null: unavailable today
  forecastSample: boolean;
  news: NewsLine[]; // every headline the search returned (capped), newest first
  whatMatters: string | null; // Gemma's one line above them, only when it found something
  newsNote: string | null; // replaces the news when it couldn't be checked
  newsSample: boolean;
  prep: string;
  unsubscribeUrl: string;
}

export interface ConfirmContent {
  siteUrl: string;
  trek: { name: string; state: string; slug: string };
  travelDate: string; // YYYY-MM-DD
  confirmUrl: string;
  unsubscribeUrl: string;
}

export interface Email {
  subject: string;
  text: string;
  html: string;
}

const SAMPLE_FORECAST = "SAMPLE DATA for development: this is not a real forecast";
const SAMPLE_NEWS = "SAMPLE DATA for development: these are not real news reports";

export function digestEmail(d: DigestContent): Email {
  const sample = d.forecastSample || d.newsSample;
  const subject = `Pagdandi · ${d.trek.name} · ${d.togo} · ${d.status}${sample ? " · SAMPLE DATA" : ""}`;
  const page = `${d.siteUrl}/treks/${d.trek.slug}`;
  const until = `You get this once a day until ${formatTravelDate(d.travelDate)}.`;
  const credits = [
    d.forecastSample ? "Forecast: sample data recorded from Open-Meteo.com." : "Weather data by Open-Meteo.com.",
    "Map data © OpenStreetMap contributors.",
    d.newsSample ? "News: sample data." : "News found through SerpApi.",
  ];
  const newsLines = d.newsNote !== null ? null : d.news;
  // A quiet day still gets its email; the stop date then sits right under the all-clear.
  const quiet = newsLines !== null && newsLines.length === 0;

  const text = [
    "Pagdandi पगडंडी · Daily update",
    "",
    d.trek.name,
    d.trek.state,
    `${d.togo} · travel date ${formatTravelDate(d.travelDate)}`,
    "",
    "FORECAST",
    ...(d.forecastSample ? [`[${SAMPLE_FORECAST}]`] : []),
    ...(d.forecast ? d.forecast.flatMap((r) => [`${r.label}: ${r.place}`, ...r.days.map((day) => `  ${day}`)]) : ["Forecast unavailable today."]),
    "",
    "NEWS THIS WEEK",
    ...(d.newsSample ? [`[${SAMPLE_NEWS}]`] : []),
    ...(newsLines === null
      ? [d.newsNote!]
      : quiet
        ? [NO_NEWS, until]
        : [...(d.whatMatters ? [`What matters: ${d.whatMatters}`] : []), ...newsLines.flatMap((n) => [`- ${n.text}`, ...(byline(n) ? [`  ${byline(n)}`] : []), ...(articleUrl(n) ? [`  ${articleUrl(n)}`] : [])])]),
    "",
    "ONE THING TO DO OUTSIDE TODAY",
    d.prep,
    "",
    `Open the trek page: ${page}`,
    ...(quiet ? [] : [until]),
    "",
    `Stop these emails: ${d.unsubscribeUrl}`,
    BRAND_LINE,
    credits.join(" "),
  ].join("\n");

  const forecastHtml = d.forecast
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${d.forecast
        .map(
          (r) => `<tr><td style="padding:10px 0;border-top:1px solid ${P.rule}">
<p style="margin:0;font-family:${BODY};font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:${P.muted}">${e(r.label)}</p>
<p style="margin:2px 0 4px;font-family:${BODY};font-size:15px;font-weight:600;color:${P.ink}">${e(r.place)}</p>
<p style="margin:0;font-family:${BODY};font-size:14px;line-height:1.6;color:${P.ink}">${r.days.map(e).join("<br>")}</p>
</td></tr>`,
        )
        .join("")}</table>`
    : para("Forecast unavailable today.");
  const newsHtml =
    newsLines === null
      ? para(d.newsNote!)
      : quiet
        ? `${para(NO_NEWS)}${para(until, 14, "6px 0 0", P.muted)}`
        : (d.whatMatters
            ? `<p style="margin:0 0 12px;font-family:${BODY};font-size:15px;line-height:1.5;color:${P.ink}"><strong style="color:${P.mossStrong}">What matters:</strong> ${e(d.whatMatters)}</p>`
            : "") +
          newsLines
            .map(
              (n) => `<p style="margin:0 0 10px;font-family:${BODY};font-size:15px;line-height:1.45;color:${P.ink}">${
                articleUrl(n) ? `<a href="${e(articleUrl(n)!)}" rel="noopener noreferrer" style="color:${P.ink};text-decoration:underline">${e(n.text)}</a>` : e(n.text)
              }${
                byline(n) ? `<br><span style="font-size:13px;color:${P.muted}">${e(byline(n)!)}</span>` : ""
              }</p>`,
            )
            .join("");

  const card = `<h1 style="margin:0;font-family:${HEADING};font-size:28px;line-height:1.2;font-weight:700;color:${P.mossStrong}">${e(d.trek.name)}</h1>
<p style="margin:4px 0 0;font-family:${BODY};font-size:14px;color:${P.muted}">${e(d.trek.state)}</p>
<p style="margin:14px 0 4px;font-family:${BODY};font-size:14px;line-height:2;color:${P.muted}"><span style="display:inline-block;background:${P.mossTint};color:${P.mossStrong};border-radius:999px;padding:2px 12px;font-size:15px;font-weight:600;line-height:1.6">${e(d.togo)}</span>&nbsp; travel date ${e(formatTravelDate(d.travelDate))}</p>
${heading("Forecast")}${d.forecastSample ? notice(SAMPLE_FORECAST) : ""}${forecastHtml}
${heading("News this week")}${d.newsSample ? notice(SAMPLE_NEWS) : ""}${newsHtml}
${heading("One thing to do outside today")}
<p style="margin:0;background:${P.deep};border-radius:8px;padding:12px 14px;font-family:${BODY};font-size:15px;line-height:1.5;color:${P.ink}">${e(d.prep)}</p>
${button(page, "Open the trek page")}`;

  const html = frame({
    title: subject,
    preheader: `${d.trek.name}: ${d.togo}, ${d.status}.`,
    kicker: "Daily update",
    siteUrl: d.siteUrl,
    card,
    footer: [...(quiet ? [] : [para(until, 13)]), `${link(d.unsubscribeUrl, "Stop these emails", P.muted)} · ${brandHtml(d.siteUrl)}`, e(credits.join(" "))],
  });
  return { subject, text, html };
}

export function confirmationEmail(c: ConfirmContent): Email {
  const subject = `Pagdandi · Confirm daily updates for ${c.trek.name}`;
  const date = formatTravelDate(c.travelDate);
  const what = "Confirm, and Pagdandi will email you once a day until your travel date: the forecast at the road head and the high point, this week's news, and one thing to do outside today.";
  const text = [
    "Pagdandi पगडंडी · Daily updates",
    "",
    `Confirm daily updates for ${c.trek.name}`,
    `${c.trek.state} · travel date ${date}`,
    "",
    what,
    "",
    `Confirm daily updates: ${c.confirmUrl}`,
    "",
    NOT_YOU,
    "",
    `Stop these emails: ${c.unsubscribeUrl}`,
    BRAND_LINE,
  ].join("\n");
  const card = `<p style="margin:0 0 6px;font-family:${BODY};font-size:13px;letter-spacing:0.06em;text-transform:uppercase;color:${P.muted}">Confirm daily updates for</p>
<h1 style="margin:0;font-family:${HEADING};font-size:28px;line-height:1.2;font-weight:700;color:${P.mossStrong}">${e(c.trek.name)}</h1>
<p style="margin:4px 0 0;font-family:${BODY};font-size:14px;color:${P.muted}">${e(c.trek.state)} · travel date ${e(date)}</p>
${para(what, 15, "16px 0 0")}
${button(c.confirmUrl, "Confirm daily updates")}
<p style="margin:0;font-family:${BODY};font-size:13px;line-height:1.5;color:${P.muted}">Or open this link:<br>${link(c.confirmUrl, c.confirmUrl, P.moss, "word-break:break-all")}</p>
${para(NOT_YOU, 14, "16px 0 0", P.muted)}`;
  const html = frame({
    title: subject,
    preheader: `One click to start daily updates for ${c.trek.name} until ${date}.`,
    kicker: "Daily updates",
    siteUrl: c.siteUrl,
    card,
    footer: [`${link(c.unsubscribeUrl, "Stop these emails", P.muted)} · ${brandHtml(c.siteUrl)}`],
  });
  return { subject, text, html };
}

const byline = (n: NewsLine) => [n.source, n.date].filter(Boolean).join(" · ") || null;
const articleUrl = (n: NewsLine) => (n.url && /^https:\/\/[^\s"'<>]+$/.test(n.url) ? n.url : null);

function para(text: string, size = 15, margin = "0", color = P.ink): string {
  return `<p style="margin:${margin};font-family:${BODY};font-size:${size}px;line-height:1.55;color:${color}">${e(text)}</p>`;
}

function heading(text: string): string {
  return `<h2 style="margin:24px 0 8px;font-family:${HEADING};font-size:19px;line-height:1.3;font-weight:700;color:${P.moss}">${e(text)}</h2>`;
}

function notice(text: string): string {
  return `<p style="margin:0 0 8px;border-left:3px solid ${P.saffron};background:${P.deep};padding:8px 12px;font-family:${BODY};font-size:13px;font-weight:600;color:${P.ink}">${e(text)}</p>`;
}

function link(href: string, label: string, color = P.moss, extra = ""): string {
  return `<a href="${e(href)}" style="color:${color};text-decoration:underline;${extra}">${e(label)}</a>`;
}

// A padded table cell with a link, which every client renders as a button.
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 12px"><tr><td style="background:${P.moss};border-radius:8px"><a href="${e(href)}" style="display:inline-block;padding:12px 22px;font-family:${BODY};font-size:16px;font-weight:600;color:${P.raised};text-decoration:none;border-radius:8px">${e(label)}</a></td></tr></table>`;
}

function brandHtml(siteUrl: string): string {
  return `<a href="${e(siteUrl)}" style="color:${P.muted};text-decoration:none">${e(BRAND_LINE)}</a>`;
}

function frame(f: { title: string; preheader: string; kicker: string; siteUrl: string; card: string; footer: string[] }): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${e(f.title)}</title></head>
<body style="margin:0;padding:0;background:${P.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${e(f.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.paper}">
<tr><td align="center" style="padding:28px 14px 36px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td style="padding:0 6px 12px;border-bottom:1px solid ${P.moss}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:bottom"><a href="${e(f.siteUrl)}" style="text-decoration:none"><span style="font-family:${HEADING};font-size:26px;line-height:1;font-weight:700;color:${P.moss}">Pagdandi</span>&nbsp;<span lang="hi" style="font-family:${BODY};font-size:19px;line-height:1;font-weight:600;color:${P.clay}">पगडंडी</span></a></td>
<td align="right" style="vertical-align:bottom;font-family:${BODY};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${P.muted}">${e(f.kicker)}</td>
</tr></table>
</td></tr>
<tr><td style="padding:22px 0 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.raised};border:1px solid ${P.rule};border-radius:12px">
<tr><td style="padding:24px 26px 22px">
${f.card}
</td></tr></table>
</td></tr>
<tr><td style="padding:18px 6px 0;font-family:${BODY};font-size:12px;line-height:1.7;color:${P.muted}">
${f.footer.map((line) => (line.startsWith("<p") ? line : `<p style="margin:0 0 4px">${line}</p>`)).join("\n")}
</td></tr>
</table>
</td></tr></table>
</body>
</html>
`;
}
