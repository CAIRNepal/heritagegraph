'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';

export default function WikiPage() {
  const [tab, setTab] = useState<'article' | 'talk'>('article');
  const [view, setView] = useState<'read' | 'source' | 'history'>('read');

  const data = {
    title: 'Banana',
    image: 'https://i.imgur.com/Qs0IADF.png',
    imageCaption:
      'Fruits of different cultivars: plantain, red banana, apple banana, Cavendish',
    sourcePlant: 'Musa',
    parts: 'Fruit',
    uses: 'Food, textiles, ornamental plants',
    family: 'Musaceae',
    origin: 'Indomalaya & Australia',
    production: 'India & China (26% of total, 2022)',
    scientificName: 'Musa acuminata × Musa balbisiana',
  };

  const seeAlso = [
    'Corporación Bananera Nacional',
    'Domesticated plants and animals of Austronesia',
    'Orange, another fruit exported and consumed in large quantities',
    'United Brands Company v Commission of the European Communities',
  ];

  const references = [
    'Morton, Julia F. (2013). "Banana". Fruits of warm climates. Echo Point Books & Media. pp. 29–46. ISBN 978-1-62654-976-0. OCLC 861735500.',
    'Picq, Claudine; INIBAP, eds. (2000). Bananas (PDF). Montpellier: INIBAP/IPGRI.',
    'Stover & Simmonds 1987, pp. 5–17.',
    'Flindt, Rainer (2006). Amazing Numbers in Biology. Springer Verlag. ISBN 978-354030146-2.',
    '"Musa acuminata \'Dwarf Cavendish\' (AAA Group) (F)". Royal Horticultural Society.',
    'Ploetz et al. 2007, p. 12.',
    'Office of the Gene Technology Regulator 2008.',
    '"Banana plant". Britannica. Retrieved March 12, 2024.',
    'Smith, James P. (1977). Vascular Plant Families. Mad River Press.',
  ];

  return (
    <div className="flex flex-col lg:flex-row max-w-7xl mx-auto px-4 sm:px-6 py-6 gap-6">
      {/* Main content */}
      <div className="flex-1">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-4 text-base">
          <ul className="flex gap-6">
            <li
              className={`cursor-pointer py-2 transition-all ${
                tab === 'article'
                  ? 'font-semibold border-b-2 border-blue-600 dark:border-blue-400 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              onClick={() => setTab('article')}
            >
              Article
            </li>
            <li
              className={`cursor-pointer py-2 transition-all ${
                tab === 'talk'
                  ? 'font-semibold border-b-2 border-blue-600 dark:border-blue-400 text-gray-900 dark:text-gray-100'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              onClick={() => setTab('talk')}
            >
              Talk
            </li>
          </ul>
        </div>

        {/* View options */}
        <div className="flex gap-2 text-sm mb-6">
          {['read', 'source', 'history'].map((v) => (
            <button
              key={v}
              onClick={() => setView(v as typeof view)}
              className={`px-3 py-1.5 rounded-md transition-all ${
                view === v
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 font-medium shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {v === 'read' ? 'Read' : v === 'source' ? 'View source' : 'View history'}
            </button>
          ))}
        </div>

        {/* Content */}
        {view === 'read' && (
          <article className="prose dark:prose-invert lg:prose-lg max-w-none">
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong className="font-semibold">Banana</strong> is an elongated, edible
              fruit—botanically a berry—produced by several kinds of large herbaceous
              flowering plants in the genus <em>Musa</em>. In many regions, cooking
              bananas are distinguished as <em>plantains</em>.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
              Description
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Banana plants are the world’s largest herbaceous flowering plants. What
              appears to be a trunk is actually a pseudostem formed by tightly packed
              leaf sheaths. Leaves can grow up to 2.7 m (8.9 ft) long. When mature, the
              plant produces a flower spike or “banana heart,” which develops into a
              hanging bunch containing hands of bananas.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
              Distribution and Cultivation
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Native to tropical Indomalaya and Australia, bananas were domesticated in
              New Guinea. Today they are cultivated in 135 countries, with India and
              China producing more than a quarter of the world’s supply.
            </p>

            <h2 className="text-xl font-semibold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
              Uses
            </h2>
            <ul className="list-disc pl-5 text-gray-700 dark:text-gray-300 space-y-1.5">
              <li>
                <strong className="font-medium">Food:</strong> Consumed raw or cooked in
                dishes such as curries, fritters, and chips.
              </li>
              <li>
                <strong className="font-medium">Textiles & Paper:</strong> Fibers from
                the plant are used in traditional crafts.
              </li>
              <li>
                <strong className="font-medium">Ornamental:</strong> Grown for
                decorative foliage and flowers.
              </li>
            </ul>

            <h2 className="text-xl font-semibold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
              Diseases
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Bananas are vulnerable to pests and diseases such as Panama disease and
              black sigatoka. These threaten Cavendish bananas, the most common variety
              in Western markets.
            </p>

            {/* See also */}
            <Card className="mt-8 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <CardContent className="p-5">
                <h2 className="text-lg font-semibold mb-3 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
                  See also
                </h2>
                <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
                  {seeAlso.map((item, i) => (
                    <li
                      key={i}
                      className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* References */}
            <h2 className="text-xl font-semibold mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
              References
            </h2>
            <Card className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm">
              <div className="bg-gray-50 dark:bg-gray-800/60 px-5 py-3 font-medium text-gray-800 dark:text-gray-200 text-sm border-b border-gray-200 dark:border-gray-700">
                Reference list
              </div>
              <ol className="divide-y divide-gray-100 dark:divide-gray-800">
                {references.map((ref, i) => (
                  <li
                    key={i}
                    className={`px-5 py-3 text-sm leading-relaxed transition-colors ${
                      i % 2 === 0
                        ? 'bg-white dark:bg-gray-900'
                        : 'bg-gray-50 dark:bg-gray-800/50'
                    } hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300`}
                  >
                    <span className="font-medium text-gray-500 dark:text-gray-400 mr-2">
                      [{i + 1}]
                    </span>
                    {ref}
                  </li>
                ))}
              </ol>
            </Card>
          </article>
        )}

        {view === 'source' && (
          <Card className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 text-sm border-b border-gray-200 dark:border-gray-700">
              Source code
            </div>
            <pre className="bg-gray-50 dark:bg-gray-900 text-sm p-5 overflow-x-auto text-gray-700 dark:text-gray-300 font-mono">
              {`== Banana ==
'''Banana''' is an elongated, edible fruit...
== Description ==
Banana plants are the world's largest herbaceous flowering plants...
[[Category:Fruit]]
[[Category:Musa]]
`}
            </pre>
          </Card>
        )}

        {view === 'history' && (
          <Card className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/60 px-4 py-2.5 font-medium text-gray-800 dark:text-gray-200 text-sm border-b border-gray-200 dark:border-gray-700">
              Revision history
            </div>
            <div className="p-5 text-sm text-gray-700 dark:text-gray-300 space-y-3">
              <div className="pb-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 last:pb-0">
                <p className="font-medium">2 Sept 2025</p>
                  <p className="text-gray-600 dark:text-gray-400">
                    User{' '}
                    <span className="text-blue-600 dark:text-blue-400">Editor42</span>{' '}
                    added &quot;Diseases&quot; section.
                  </p>
              </div>
              <div className="pb-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 last:pb-0">
                <p className="font-medium">28 Aug 2025</p>
                <p className="text-gray-600 dark:text-gray-400">
                  User{' '}
                  <span className="text-blue-600 dark:text-blue-400">FruitLover</span>{' '}
                  updated production statistics.
                </p>
              </div>
              <div className="pb-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0 last:pb-0">
                <p className="font-medium">15 Aug 2025</p>
                <p className="text-gray-600 dark:text-gray-400">
                  Page created by{' '}
                  <span className="text-blue-600 dark:text-blue-400">Seedling99</span>.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Infobox */}
      <aside className="w-full lg:w-80 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 shadow-sm self-start sticky top-6">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 font-bold text-center text-lg border-b border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200">
          {data.title}
        </div>
        <div className="p-4 space-y-4">
          <div className="relative w-full aspect-square border rounded-md overflow-hidden dark:border-gray-700">
            <Image
              src={data.image}
              alt={data.imageCaption}
              fill
              className="object-cover"
              priority
            />
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 italic text-center">
            {data.imageCaption}
          </p>
          <table className="w-full text-xs border-t border-gray-200 dark:border-gray-700 pt-2">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr>
                <td className="font-medium py-2 pr-2 align-top text-gray-700 dark:text-gray-300">
                  Scientific name
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">
                  {data.scientificName}
                </td>
              </tr>
              <tr>
                <td className="font-medium py-2 pr-2 align-top text-gray-700 dark:text-gray-300">
                  Family
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{data.family}</td>
              </tr>
              <tr>
                <td className="font-medium py-2 pr-2 align-top text-gray-700 dark:text-gray-300">
                  Source plant(s)
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">
                  {data.sourcePlant}
                </td>
              </tr>
              <tr>
                <td className="font-medium py-2 pr-2 align-top text-gray-700 dark:text-gray-300">
                  Part(s) of plant
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{data.parts}</td>
              </tr>
              <tr>
                <td className="font-medium py-2 pr-2 align-top text-gray-700 dark:text-gray-300">
                  Uses
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{data.uses}</td>
              </tr>
              <tr>
                <td className="font-medium py-2 pr-2 align-top text-gray-700 dark:text-gray-300">
                  Origin
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">{data.origin}</td>
              </tr>
              <tr>
                <td className="font-medium py-2 pr-2 align-top text-gray-700 dark:text-gray-300">
                  Production
                </td>
                <td className="py-2 text-gray-600 dark:text-gray-400">
                  {data.production}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </aside>
    </div>
  );
}
