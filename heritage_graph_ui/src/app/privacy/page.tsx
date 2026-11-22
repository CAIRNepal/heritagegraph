import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export const metadata = {
  title: 'Privacy Policy — HeritageGraph',
  description: 'How HeritageGraph handles data from contributors and visitors.',
};

interface Section {
  h: string;
  p: string[];
}

export default async function PrivacyPage() {
  const t = await getTranslations('privacy');
  const sections = t.raw('sections') as Section[];
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <h1 className="font-serif text-4xl">{t('title')}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t('updated')}</p>
      {/* The wording describes what the code does; the institution has not signed it off yet. */}
      <p className="mt-4 rounded-lg border border-warning/50 bg-warning-soft px-3 py-2 text-sm text-warning-on-soft">
        {t('draft')}
      </p>

      {sections.map((section) => (
        <section key={section.h} className="mt-8">
          <h2 className="font-serif text-2xl">{section.h}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
            {section.p.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}

      <p className="mt-8 leading-relaxed">{t('thirdParties')}</p>
      <p className="mt-3">
        {t('termsLead')}{' '}
        <Link href="/terms" className="text-primary underline underline-offset-2">
          {t('termsLink')}
        </Link>
        .
      </p>
    </main>
  );
}
