import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

import { Button } from '@/components/ui/button';
import {
  DANAM_NQ_SHA256,
  HERITAGEGRAPH_CITATION,
  HERITAGEGRAPH_DOI,
  HERITAGEGRAPH_PUBLIC_GRAPH,
  HERITAGEGRAPH_RELEASE,
  LICENSE_MATRIX,
} from '@/lib/provenance';

export async function generateMetadata() {
  const t = await getTranslations('methods');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

/** Inline code span used inside translated rich text. */
const code = (chunks: React.ReactNode) => (
  <code className="text-xs">{chunks}</code>
);

/** Emphasised lead-in term inside translated rich text. */
const term = (chunks: React.ReactNode) => (
  <span className="font-medium text-foreground">{chunks}</span>
);

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-xl font-semibold text-foreground">{children}</h2>
  );
}

/** Reviewer personas, in ascending order of what they are permitted to do. */
const REVIEWER_PERSONAS = ['communityReviewer', 'domainExpert', 'expertCurator'] as const;

const FAIR_POINTS = ['findable', 'accessible', 'interoperable', 'reusable', 'care'] as const;

const MODEL_POINTS = ['schema', 'namedGraph', 'museumView', 'lux', 'twoLayer'] as const;

const PIPELINE_STEPS = ['save', 'review', 'project', 'integrity', 'evaluate'] as const;

const LIMITATIONS = [
  'corpusSize',
  'temporal',
  'reconciliation',
  'demoCorpus',
  'doi',
  'shacl',
  'evaluation',
  'consent',
] as const;

export default async function MethodsPage() {
  const t = await getTranslations('methods');

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {t('eyebrow')}
        </p>
        <h1 className="font-serif text-3xl font-semibold text-foreground">{t('title')}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('intro')}</p>
      </header>

      <section className="space-y-3">
        <SectionHeading>{t('release.heading')}</SectionHeading>
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">{t('release.version')}</dt>
          <dd className="font-mono">{HERITAGEGRAPH_RELEASE}</dd>
          <dt className="text-muted-foreground">{t('release.doi')}</dt>
          <dd className={HERITAGEGRAPH_DOI ? 'font-mono break-all' : 'text-muted-foreground'}>
            {HERITAGEGRAPH_DOI ?? t('release.doiPending')}
          </dd>
          <dt className="text-muted-foreground">{t('release.codeLicense')}</dt>
          <dd>MIT</dd>
          <dt className="text-muted-foreground">{t('release.dataLicense')}</dt>
          <dd>{t('release.dataLicenseValue')}</dd>
        </dl>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-xs">
          {HERITAGEGRAPH_CITATION}
        </pre>
      </section>

      {/* Review model — the platform's central human-in-the-loop claim, so it is
          documented here rather than only asserted on the About page. */}
      <section className="space-y-3">
        <SectionHeading>{t('review.heading')}</SectionHeading>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.rich('review.intro', { code })}
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-2 font-medium">{t('review.tablePersona')}</th>
                <th className="p-2 font-medium">{t('review.tableCan')}</th>
                <th className="p-2 font-medium">{t('review.tableCannot')}</th>
              </tr>
            </thead>
            <tbody>
              {REVIEWER_PERSONAS.map((persona) => (
                <tr key={persona} className="border-b border-border last:border-0">
                  <td className="p-2 align-top text-foreground">
                    {t(`review.personas.${persona}.name`)}
                  </td>
                  <td className="p-2 align-top text-muted-foreground">
                    {t(`review.personas.${persona}.can`)}
                  </td>
                  <td className="p-2 align-top text-muted-foreground">
                    {t(`review.personas.${persona}.cannot`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>{t.rich('review.assignment', { code, term })}</li>
          <li>{t.rich('review.separationOfDuties', { code, term })}</li>
          <li>{t.rich('review.publicationGate', { code, term })}</li>
          <li>{t.rich('review.labelGate', { code, term })}</li>
          <li>{t.rich('review.identityLock', { code, term })}</li>
        </ul>
        <p className="text-xs text-muted-foreground">{t('review.selectivityCaveat')}</p>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t('fair.heading')}</SectionHeading>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {FAIR_POINTS.map((point) => (
            <li key={point}>{t.rich(`fair.${point}`, { code, term })}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          {t.rich('fair.checklist', { code })}
        </p>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t('licenses.heading')}</SectionHeading>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="p-2 font-medium">{t('licenses.layer')}</th>
                <th className="p-2 font-medium">{t('licenses.license')}</th>
                <th className="p-2 font-medium">{t('licenses.note')}</th>
              </tr>
            </thead>
            <tbody>
              {LICENSE_MATRIX.map((row) => (
                <tr key={row.key} className="border-b border-border last:border-0">
                  <td className="p-2 align-top text-foreground">
                    {t(`licenses.layers.${row.key}.name`)}
                  </td>
                  <td className="p-2 align-top font-mono text-xs">{row.license}</td>
                  <td className="p-2 align-top text-muted-foreground">
                    {t(`licenses.layers.${row.key}.note`)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t('model.heading')}</SectionHeading>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {MODEL_POINTS.map((point) => (
            <li key={point}>
              {t.rich(`model.${point}`, {
                code,
                term,
                graph: HERITAGEGRAPH_PUBLIC_GRAPH,
              })}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t('corpusPin.heading')}</SectionHeading>
        <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-2 text-sm">
          <dt className="text-muted-foreground">{t('corpusPin.dump')}</dt>
          <dd className="break-all font-mono text-xs">data/reconciled/danam-heritagegraph.nq</dd>
          <dt className="text-muted-foreground">{t('corpusPin.sha')}</dt>
          <dd className="break-all font-mono text-xs">{DANAM_NQ_SHA256}</dd>
          <dt className="text-muted-foreground">{t('corpusPin.l0')}</dt>
          <dd>{t.rich('corpusPin.l0Value', { code })}</dd>
          <dt className="text-muted-foreground">{t('corpusPin.l1')}</dt>
          <dd>{t.rich('corpusPin.l1Value', { code })}</dd>
          <dt className="text-muted-foreground">{t('corpusPin.competency')}</dt>
          <dd>
            <code className="text-xs">
              documentation/research/competency_queries.sparql
            </code>
          </dd>
        </dl>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t('pipeline.heading')}</SectionHeading>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          {PIPELINE_STEPS.map((step) => (
            <li key={step}>{t.rich(`pipeline.${step}`, { code, term })}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t('limitations.heading')}</SectionHeading>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          {LIMITATIONS.map((item) => (
            <li key={item}>{t.rich(`limitations.${item}`, { code, term })}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <SectionHeading>{t('lux.heading')}</SectionHeading>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.rich('lux.body', { code })}
        </p>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-4">
        <Button asChild variant="default" size="sm">
          <Link href="/heritage-museum?source=live">{t('cta.museum')}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/about">{t('cta.about')}</Link>
        </Button>
      </div>
    </div>
  );
}
