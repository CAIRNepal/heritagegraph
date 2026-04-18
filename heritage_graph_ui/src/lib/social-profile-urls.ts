/**
 * Turn stored profile social values into safe absolute URLs.
 * Accepts full URLs, www…, or plain @handles / usernames.
 */

export const SOCIAL_PLATFORMS = [
  "twitter",
  "linkedin",
  "github",
  "facebook",
  "instagram",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * If the value already has a URL shape, return a normalized absolute URL; otherwise null.
 */
export function tryNormalizeExistingUrlOrDomain(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const l = t.toLowerCase();
  if (l.startsWith("http://") || l.startsWith("https://")) return t;
  if (l.startsWith("www.")) return `https://${t}`;
  if (
    /^(www\.)?([a-z0-9-]+\.)?(linkedin|facebook|instagram|github|x|twitter)\.com(\/|$)/i.test(
      t
    )
  ) {
    if (l.startsWith("www.")) return `https://${t}`;
    return `https://www.${t.replace(/^\/*/, "")}`;
  }
  // bare domain: example.com
  if (/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z]{2,}(?:\/.*)?$/i.test(t) && t.includes("/")) {
    return `https://${t}`;
  }
  return null;
}

function handleFromPath(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .split("/")
    .filter(Boolean)
    .pop() || "";
}

/**
 * Resolve a single social field to an https URL for `href` or for persisting.
 */
export function socialProfileUrl(platform: SocialPlatform, input: string): string {
  const t = input.trim();
  if (!t) return "";
  const asUrl = tryNormalizeExistingUrlOrDomain(t);
  if (asUrl) return asUrl;
  const s = t.replace(/^@+/, "").replace(/^\/*/, "");
  if (!s) return "";
  if (platform === "linkedin") {
    if (/^in\//i.test(s) || s.includes("/in/") || s.startsWith("in/")) {
      const p = s.includes("/in/") ? s.slice(s.indexOf("in/")) : s;
      return `https://www.linkedin.com/${p.startsWith("in/") ? p : `in/${p}`}`.replace(
        /\/+$/,
        "/"
      );
    }
    return `https://www.linkedin.com/in/${handleFromPath(s)}/`;
  }
  const h = handleFromPath(s) || s;
  switch (platform) {
    case "twitter":
      return `https://x.com/${h}`;
    case "github":
      return `https://github.com/${h}`;
    case "facebook":
      return `https://www.facebook.com/${h}`;
    case "instagram":
      return `https://www.instagram.com/${h}/`;
    default:
      return t;
  }
}

/**
 * Map `social_links` and `website_link` for saving to the API.
 */
export function normalizeSocialLinksForSave(
  form: Record<string, string>
): { website_link: string; social_links: Record<string, string> } {
  const w = (form.website_link || "").trim();
  let website_link = "";
  if (w) {
    const u = tryNormalizeExistingUrlOrDomain(w);
    if (u) website_link = u;
    else if (w.startsWith("http://") || w.startsWith("https://")) website_link = w;
    else website_link = w.includes(".") ? `https://${w.replace(/^\/+/, "")}` : w;
  }
  const out: Record<string, string> = {};
  for (const p of SOCIAL_PLATFORMS) {
    const v = (form as Record<string, string>)[p]?.trim();
    if (v) out[p] = socialProfileUrl(p, v);
  }
  return { website_link, social_links: out };
}
