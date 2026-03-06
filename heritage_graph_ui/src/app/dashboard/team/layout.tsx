import type { Metadata } from 'next';

/**
 * SEO metadata for the /dashboard/team page.
 *
 * Because the page component is a client component ('use client'),
 * Next.js requires metadata to be exported from a server component.
 * This route-level layout serves that purpose and also injects
 * JSON-LD structured data for rich search-engine indexing.
 */

/* ── Canonical team data — kept in sync with page.tsx ── */
const teamData = [
  {
    name: 'Dr. Tek Raj Chhetri',
    jobTitle: 'Project Lead | Researcher in AI and Digital Heritage',
    url: 'http://www.cair-nepal.org/team/members/tek-raj-chhetri/',
    image: '/cair-logo/tekraj.jpeg',
  },
  {
    name: 'Dr. Semih Yumusak',
    jobTitle: 'Advisor | Semantic Web and Knowledge Graph Expert',
    url: 'http://www.cair-nepal.org/team/members/dr-semih-yumusak/',
    image: '/cair-logo/semih.jpeg',
  },
  {
    name: 'Nabin Oli',
    jobTitle: 'Machine Learning Researcher | Data & Graph Modeling',
    url: 'http://www.cair-nepal.org/team/members/nabin-oli/',
    image: '/cair-logo/nabin.jpeg',
  },
  {
    name: 'Niraj Karki',
    jobTitle: 'Software Engineer | Backend & Infrastructure',
    url: 'http://www.cair-nepal.org/team/members/niraj-karki/',
    image: '/cair-logo/niraj.jpeg',
  },
  {
    name: 'Anu Sapkota',
    jobTitle: 'Researcher | Cultural Heritage & Knowledge Systems',
    url: 'http://www.cair-nepal.org/team/members/anu-sapkota/',
    image: '/cair-logo/anu_sapkota.jpeg',
  },
];

/* ── Next.js Metadata export — drives <title>, <meta>, Open Graph, etc. ── */
export const metadata: Metadata = {
  title: 'Our Team — HeritageGraph | CAIR-Nepal',
  description:
    'Meet the multidisciplinary team behind HeritageGraph — researchers, engineers, and domain experts preserving cultural heritage through AI, knowledge graphs, and linked open data.',
  keywords: [
    'HeritageGraph team',
    'CAIR-Nepal',
    'cultural heritage AI',
    'digital heritage',
    'knowledge graph',
    'linked open data',
    'Nepal heritage',
    'Tek Raj Chhetri',
    'Semih Yumusak',
    'Nabin Oli',
    'Niraj Karki',
    'Anu Sapkota',
  ],
  openGraph: {
    title: 'Our Team — HeritageGraph',
    description:
      'A multidisciplinary team working at the intersection of AI, cultural heritage, and digital knowledge systems.',
    type: 'website',
    siteName: 'HeritageGraph',
    images: [
      {
        url: '/cair-logo/fulllogo_nobuffer.png',
        width: 1200,
        height: 630,
        alt: 'HeritageGraph Team — CAIR-Nepal',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Our Team — HeritageGraph',
    description:
      'Meet the minds behind HeritageGraph — preserving cultural heritage through AI and linked open data.',
    images: ['/cair-logo/fulllogo_nobuffer.png'],
  },
  alternates: {
    canonical: '/dashboard/team',
  },
};

/**
 * JSON-LD structured data (schema.org).
 *
 * Outputs an Organization entity with its team members listed as
 * schema:Person objects — this helps Google, Bing, and other engines
 * surface rich results for "CAIR-Nepal team" / "HeritageGraph people".
 */
function TeamJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'CAIR-Nepal',
    url: 'https://www.cair-nepal.org/',
    description:
      'Center for Artificial Intelligence Research, Nepal — building HeritageGraph, a platform for digitally preserving cultural heritage as linked open data.',
    logo: '/cair-logo/fulllogo_nobuffer.png',
    member: teamData.map((person) => ({
      '@type': 'Person',
      name: person.name,
      jobTitle: person.jobTitle,
      url: person.url,
      image: person.image,
      worksFor: {
        '@type': 'Organization',
        name: 'CAIR-Nepal',
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/* ── Layout component ── */
export default function TeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Inject structured data into <head> for SEO crawlers */}
      <TeamJsonLd />
      {children}
    </>
  );
}
