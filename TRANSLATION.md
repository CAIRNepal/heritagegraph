# TRANSLATION.md — Internationalization (i18n) Guide for Contributors

> **Purpose:** Step-by-step guide for contributors who want to translate HeritageGraph pages into Nepali (or add new languages).

---

## 📖 How i18n Works in HeritageGraph

HeritageGraph uses [**next-intl v4**](https://next-intl.dev/) for internationalization in the Next.js frontend (`heritage_graph_ui/`).

**Key design decisions:**

| Aspect | How it works |
|--------|-------------|
| Locale detection | **Cookie-based** — a `NEXT_LOCALE` cookie stores the user's language preference |
| URL structure | **No URL prefix** — `/dashboard` stays `/dashboard` in all languages (no `/ne/dashboard`) |
| Default locale | `en` (English) |
| Supported locales | `en`, `ne` (Nepali) |
| Message files | `heritage_graph_ui/messages/en.json` and `heritage_graph_ui/messages/ne.json` |
| Language switching | `LanguageSwitcher` component in the dashboard header sets the cookie and refreshes |

---

## 📁 File Structure

```
heritage_graph_ui/
├── messages/
│   ├── en.json                          # English translations (source of truth)
│   └── ne.json                          # Nepali translations
├── src/
│   ├── i18n/
│   │   ├── routing.ts                   # Locale constants, cookie name, Nepali digit helpers
│   │   ├── request.ts                   # Server-side locale resolution (reads cookie)
│   │   ├── navigation.ts               # Re-exports next/link and next/navigation
│   │   └── index.ts                     # Barrel exports
│   ├── app/
│   │   └── layout.tsx                   # Root layout — wraps app in NextIntlClientProvider
│   └── components/
│       └── language-switcher.tsx         # UI for toggling between EN ↔ NE
```

---

## ✅ How to Translate a Page (Step-by-Step)

### Overview

Converting a page to support i18n is a 3-step process:

1. **Add translation keys** to `messages/en.json`
2. **Add Nepali translations** to `messages/ne.json`
3. **Replace hardcoded strings** in the component with `t('key')` calls

---

### Step 1: Add translation keys to `en.json`

Open `heritage_graph_ui/messages/en.json` and add a new **namespace** (top-level key) for the page. Use an existing namespace if the page already has one.

**Example:** Translating the Team page (`/dashboard/team`)

```json
{
  "team": {
    "title": "Meet the Team",
    "subtitle": "The researchers, engineers, and cultural heritage advocates behind HeritageGraph.",
    "coreTeam": "Core Team",
    "githubContributors": "GitHub Contributors",
    "githubSubtitle": "Open-source contributors who have helped build HeritageGraph.",
    "viewProfile": "View Profile",
    "contributions": "{count} contributions",
    "loading": "Loading contributors…",
    "viewOnGithub": "View on GitHub"
  }
}
```

**Naming rules:**
- **Namespace** = page name in camelCase (`team`, `dashboard`, `contribute`, `about`)
- **Keys** = descriptive camelCase (`heroTitle`, `submitButton`, `noResults`)
- **Dynamic values** use `{placeholder}` syntax: `"Welcome, {name}!"` → `t('welcome', { name: userName })`

---

### Step 2: Add Nepali translations to `ne.json`

Open `heritage_graph_ui/messages/ne.json` and add the **exact same keys** with Nepali values:

```json
{
  "team": {
    "title": "टोलीलाई भेट्नुहोस्",
    "subtitle": "हेरिटेजग्राफ पछाडिका अनुसन्धानकर्ता, इन्जिनियर, र सांस्कृतिक सम्पदा अधिवक्ताहरू।",
    "coreTeam": "मुख्य टोली",
    "githubContributors": "GitHub योगदानकर्ताहरू",
    "githubSubtitle": "हेरिटेजग्राफ निर्माण गर्न मद्दत गर्ने ओपन-सोर्स योगदानकर्ताहरू।",
    "viewProfile": "प्रोफाइल हेर्नुहोस्",
    "contributions": "{count} योगदान",
    "loading": "योगदानकर्ताहरू लोड हुँदैछ…",
    "viewOnGithub": "GitHub मा हेर्नुहोस्"
  }
}
```

> **Important:** Both JSON files must have the **exact same key structure**. If a key exists in `en.json` but not in `ne.json`, it will fall back to the English value.

---

### Step 3: Replace hardcoded strings in the component

#### 3a. Import `useTranslations`

```tsx
import { useTranslations } from 'next-intl';
```

> The component must be a client component (`'use client'`) to use `useTranslations` in event handlers and JSX. For server components, use `getTranslations` from `next-intl/server` instead.

#### 3b. Initialize the translation function with your namespace

```tsx
export default function TeamPage() {
  const t = useTranslations('team');
  // ...
}
```

#### 3c. Replace every hardcoded string with `t('key')`

**Before:**
```tsx
<h1>Meet the Team</h1>
<p>The researchers, engineers, and cultural heritage advocates behind HeritageGraph.</p>
<span>{contributor.contributions} contributions</span>
```

**After:**
```tsx
<h1>{t('title')}</h1>
<p>{t('subtitle')}</p>
<span>{t('contributions', { count: contributor.contributions })}</span>
```

---

## 🔧 Complete Before & After Example

Here's a minimal example showing the full conversion of a component:

### Before (hardcoded English):

```tsx
'use client';

export default function ProgressionPage() {
  return (
    <div>
      <h1>Your Progression</h1>
      <p>Track your heritage contribution journey</p>
      <span>Level 3: Heritage Guardian</span>
    </div>
  );
}
```

### After (i18n-enabled):

```tsx
'use client';

import { useTranslations } from 'next-intl';

export default function ProgressionPage() {
  const t = useTranslations('progression');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
      <span>{t('currentLevel', { level: 3, rank: t('ranks.heritageGuardian') })}</span>
    </div>
  );
}
```

With these entries in the message files:

**en.json:**
```json
{
  "progression": {
    "title": "Your Progression",
    "subtitle": "Track your heritage contribution journey",
    "currentLevel": "Level {level}: {rank}",
    "ranks": {
      "heritageGuardian": "Heritage Guardian"
    }
  }
}
```

**ne.json:**
```json
{
  "progression": {
    "title": "तपाईंको प्रगति",
    "subtitle": "तपाईंको सम्पदा योगदान यात्रा ट्र्याक गर्नुहोस्",
    "currentLevel": "स्तर {level}: {rank}",
    "ranks": {
      "heritageGuardian": "सम्पदा संरक्षक"
    }
  }
}
```

---

## 📋 Existing Namespaces

These namespaces already exist in both `en.json` and `ne.json`:

| Namespace | Used by | Status |
|-----------|---------|--------|
| `common` | Shared UI (buttons, labels, status) | ✅ Translated |
| `metadata` | HTML meta tags | ✅ Translated |
| `auth` | Login/signup pages | ✅ Translated |
| `nav` | Sidebar navigation labels | ✅ Translated |
| `user` | User menu (profile, settings) | ✅ Translated |
| `dashboard` | Dashboard home page | ✅ Keys exist (page not yet wired) |
| `contribute` | Contribution forms | ✅ Keys exist (page not yet wired) |
| `knowledge` | Knowledge base pages | ✅ Keys exist (pages not yet wired) |
| `review` | Review/moderation UI | ✅ Keys exist (page not yet wired) |
| `calendar` | Bikram Sambat calendar | ✅ Translated |
| `language` | Language switcher | ✅ Translated |
| `landing` | Frontend landing page | ✅ Keys exist (page not yet wired) |
| `about` | About page | ✅ Fully wired |

**Pages that still need translation work:**

| Page | Route | Namespace to use | What's needed |
|------|-------|-------------------|---------------|
| Dashboard Home | `/dashboard` | `dashboard` | Wire existing keys + add missing ones |
| Team | `/dashboard/team` | `team` | Add keys + wire |
| Contribute | `/dashboard/contribute` | `contribute` | Wire existing keys + add missing ones |
| Progression | `/dashboard/progression` | `progression` | Add keys + wire |
| Leaderboard | `/dashboard/leaderboard` | `leaderboard` | Add keys + wire |
| Notifications | `/dashboard/notification` | `notifications` | Add keys + wire |
| Knowledge pages | `/dashboard/knowledge/*` | `knowledge` | Wire existing keys |
| Curation pages | `/dashboard/curation/*` | `review` | Wire existing keys + add missing ones |
| Community pages | `/dashboard/community/*` | `community` | Add keys + wire |
| Graph View | `/dashboard/graphview` | `graphview` | Add keys + wire |
| Landing page | `/` | `landing` | Wire existing keys |

---

## 🌏 Adding a New Language

To add support for a new language (e.g., Hindi `hi`):

### 1. Create the message file

```bash
cp heritage_graph_ui/messages/en.json heritage_graph_ui/messages/hi.json
```

Then translate all values in `hi.json` to Hindi.

### 2. Register the locale

Edit `heritage_graph_ui/src/i18n/routing.ts`:

```diff
- export const locales = ['en', 'ne'] as const;
+ export const locales = ['en', 'ne', 'hi'] as const;
```

### 3. Update the language switcher

Edit `heritage_graph_ui/src/components/language-switcher.tsx`:

```diff
  const localeLabels: Record<Locale, { label: string; flag: string }> = {
    en: { label: 'English', flag: '🇬🇧' },
    ne: { label: 'नेपाली', flag: '🇳🇵' },
+   hi: { label: 'हिन्दी', flag: '🇮🇳' },
  };
```

### 4. Test

Switch to the new language using the globe icon in the dashboard header and verify all pages render correctly.

---

## 💡 Tips & Best Practices

### DO:
- **Keep keys flat within a namespace** — avoid nesting deeper than 2 levels
- **Use `{placeholder}` for dynamic values** — never concatenate strings
- **Reuse `common` namespace** for shared UI text (Save, Cancel, Delete, etc.)
- **Use multiple namespaces in one component** when needed:
  ```tsx
  const t = useTranslations('team');
  const tc = useTranslations('common');
  // ...
  <Button>{tc('save')}</Button>
  ```
- **Test with both languages** after making changes
- **Keep both JSON files in sync** — every key in `en.json` must exist in `ne.json`

### DON'T:
- **Don't translate inside `data` arrays/objects** defined outside the component — move them inside or use a pattern like:
  ```tsx
  // Instead of this (won't work — t() can only be called inside React components):
  const items = [{ title: t('item1') }]; // ❌ outside component
  
  // Do this:
  export default function MyPage() {
    const t = useTranslations('myPage');
    const items = [{ title: t('item1') }]; // ✅ inside component
  }
  ```
- **Don't hardcode locale-specific formatting** — use `next-intl`'s date/number formatters
- **Don't modify `en.json` keys** without updating `ne.json` (and all other locale files)
- **Don't add HTML inside translation strings** — use rich text formatting instead:
  ```tsx
  // In JSON: "message": "Visit <link>our site</link>"
  t.rich('message', {
    link: (chunks) => <a href="/site">{chunks}</a>
  })
  ```

---

## 🧪 Verifying Your Translation

1. **Start the dev server:**
   ```bash
   cd heritage_graph_ui && npm run dev
   ```

2. **Switch languages** using the globe (🌐) icon in the dashboard header

3. **Check for:**
   - Missing translations (will show the English fallback or the raw key)
   - Layout breakage (Nepali text is often longer than English)
   - Placeholder values rendering correctly (`{name}`, `{count}`, etc.)
   - Text not overflowing containers

4. **Validate JSON syntax:**
   ```bash
   # Quick check for valid JSON
   python3 -c "import json; json.load(open('messages/en.json')); print('en.json OK')"
   python3 -c "import json; json.load(open('messages/ne.json')); print('ne.json OK')"
   ```

5. **Check for missing keys** (keys in en.json but not in ne.json):
   ```bash
   # Compare key structures
   python3 -c "
   import json

   def get_keys(obj, prefix=''):
       keys = set()
       for k, v in obj.items():
           full = f'{prefix}.{k}' if prefix else k
           if isinstance(v, dict):
               keys |= get_keys(v, full)
           else:
               keys.add(full)
       return keys

   en = get_keys(json.load(open('messages/en.json')))
   ne = get_keys(json.load(open('messages/ne.json')))
   missing = en - ne
   if missing:
       print(f'Missing {len(missing)} keys in ne.json:')
       for k in sorted(missing):
           print(f'  - {k}')
   else:
       print('All keys present in both files ✅')
   "
   ```

---

## 🔍 Quick Reference

| Task | How |
|------|-----|
| Use translations in a client component | `import { useTranslations } from 'next-intl'` → `const t = useTranslations('namespace')` |
| Use translations in a server component | `import { getTranslations } from 'next-intl/server'` → `const t = await getTranslations('namespace')` |
| Dynamic values | `t('greeting', { name: 'Nabin' })` → `"Hello, {name}!"` → `"Hello, Nabin!"` |
| Nested keys | `t('knowledge.entity.title')` or use nested namespace `useTranslations('knowledge.entity')` |
| Plural forms | `t('items', { count: 5 })` with ICU syntax in JSON: `"{count, plural, one {# item} other {# items}}"` |
| Rich text (inline JSX) | `t.rich('msg', { bold: (chunks) => <strong>{chunks}</strong> })` |
| Raw HTML | `t.raw('htmlContent')` — use sparingly |
| Locale cookie name | `NEXT_LOCALE` |
| Supported locales | `en`, `ne` (defined in `src/i18n/routing.ts`) |

---

## 📚 Further Reading

- [next-intl documentation](https://next-intl.dev/docs/getting-started)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [HeritageGraph Contributing Guide](contributing.md)
