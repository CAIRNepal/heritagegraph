import Link from 'next/link';

export const metadata = {
  title: 'Terms of Contribution — HeritageGraph',
  description: 'Terms governing contributions to the HeritageGraph cultural-heritage knowledge graph.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose prose-neutral dark:prose-invert">
      <h1>Terms of Contribution</h1>
      <p className="text-sm text-muted-foreground">Last updated: 2026-06-10 · CAIR-Nepal</p>

      <p>
        HeritageGraph is an open cultural-heritage knowledge graph operated by CAIR-Nepal.
        By submitting a contribution you agree to the terms below.
      </p>

      <h2>1. Review before publication</h2>
      <p>
        Every contribution enters a community/curator review queue and is <strong>not published
        until reviewed and accepted</strong>. We may edit, decline, or remove contributions that are
        inaccurate, unverifiable, disrespectful, or that infringe the rights of others.
      </p>

      <h2>2. Licensing of your contribution</h2>
      <p>
        Accepted factual contributions are published as Linked Open Data under the{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          Creative Commons Attribution 4.0 International (CC BY 4.0)
        </a>{' '}
        licence. By contributing you confirm that you have the right to share the information and
        that you grant this licence. Provide attribution and sources for any material that is not
        your own.
      </p>

      <h2>3. Accuracy and provenance</h2>
      <p>
        HeritageGraph aims for source-backed, provenance-tracked data. Please contribute information
        you believe to be accurate and, where possible, cite a source. Contributions are recorded
        with attribution and a timestamp.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        Do not submit unlawful, defamatory, or culturally harmful content, personal data about living
        individuals without consent, or copyrighted material you are not entitled to share.
      </p>

      <h2>5. No warranty</h2>
      <p>
        HeritageGraph is provided “as is” for research and educational purposes. We make no warranty
        as to completeness or accuracy of the published graph.
      </p>

      <p>
        See also our <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </main>
  );
}
