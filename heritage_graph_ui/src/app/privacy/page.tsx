import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — HeritageGraph',
  description: 'How HeritageGraph handles data from contributors and visitors.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose prose-neutral dark:prose-invert">
      <h1>Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last updated: 2026-06-10 · CAIR-Nepal</p>

      <p>
        This policy explains what data HeritageGraph (operated by CAIR-Nepal) collects and how it
        is used.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — if you sign in, the name and email address from your
          identity provider (Google), used to attribute contributions and manage review.
        </li>
        <li>
          <strong>Contributions</strong> — the heritage information you submit, your attribution as
          contributor, and a timestamp.
        </li>
        <li>
          <strong>Operational logs</strong> — standard server logs (e.g. request metadata) for
          security and reliability.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To review, attribute, and publish accepted contributions in the public knowledge graph.</li>
        <li>To operate, secure, and improve the platform.</li>
      </ul>

      <h2>What becomes public</h2>
      <p>
        Accepted <strong>contributions</strong> and your <strong>contributor attribution</strong> are
        published as open data under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          CC BY 4.0
        </a>. Your email address and authentication details are <strong>not</strong> published.
        Please do not submit personal data about living individuals without their consent.
      </p>

      <h2>Retention and access</h2>
      <p>
        Account and contribution records are retained while your account is active. You may request
        access to, correction of, or deletion of your personal data by contacting CAIR-Nepal; note
        that already-published, openly-licensed contributions may persist in downstream copies of
        the open dataset.
      </p>

      <h2>Third parties</h2>
      <p>
        Authentication is provided by Google. External authority links (e.g. Wikidata, Getty) point
        to third-party sites governed by their own policies.
      </p>

      <p>
        See also our <Link href="/terms">Terms of Contribution</Link>.
      </p>
    </main>
  );
}
