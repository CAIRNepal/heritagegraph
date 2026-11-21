export const DUMMY_RESPONSES: {
  keywords: string[];
  response: string;
  nav?: string;
}[] = [
  {
    keywords: ['indra jatra', 'indra'],
    response:
      '[[Indra Jatra]] is an 8-day festival celebrated in [[Kathmandu]] every September, honoring the deity [[Indra]]. It features the display of [[Kumari Devi]] and erection of the ceremonial pole at [[Basantapur]].',
  },
  {
    keywords: ['pashupatinath', 'pashupati'],
    response:
      '[[Pashupatinath Temple]] is a UNESCO World Heritage Site on the banks of the [[Bagmati River]]. It is one of the most sacred [[Shiva]] temples in Asia, documented since the 5th century.',
  },
  {
    keywords: ['guthi'],
    response:
      'A [[Guthi]] is a traditional Newar social institution that organises festivals, funerals, and community life. They are unique to the [[Newar]] people of the [[Kathmandu Valley]].',
  },
  {
    keywords: ['monument', 'monuments', 'go to monuments', 'show monuments'],
    response: 'Taking you to the Monuments section.',
    nav: '/knowledge/monument',
  },
  {
    keywords: ['festival', 'festivals', 'go to festivals'],
    response: 'Taking you to the Festivals section.',
    nav: '/knowledge/festival',
  },
  {
    keywords: ['dashboard', 'go to dashboard'],
    response: 'Taking you to your dashboard.',
    nav: '/',
  },
  {
    keywords: ['contribute', 'add entity', 'how do i add'],
    response:
      "To contribute, go to the [[Contribute]] page and select an entity type. You'll fill in a structured form — your submission enters the curation queue for review.",
    nav: '/contribute',
  },
  {
    keywords: ['fork', 'forking', 'how do i fork'],
    response:
      'Forking lets you propose a correction or alternate interpretation of an existing entity. Open any entity page and click "Fork this" — you\'ll be able to edit specific fields and submit your version for review.',
  },
  {
    keywords: ['what is heritagegraph', 'what is heritage graph'],
    response:
      '[[HeritageGraph]] is an open knowledge graph platform for Nepali and Newar cultural heritage. It connects monuments, festivals, deities, guthis, and traditions in a structured, research-grade graph aligned with [[CIDOC-CRM]].',
  },
  {
    keywords: ['kumari', 'living goddess'],
    response:
      '[[Kumari Devi]] is the living goddess tradition of the [[Newar]] community. The chosen girl, usually from the [[Shakya]] caste, is worshipped as the incarnation of the goddess [[Taleju]] until she reaches puberty.',
  },
];

export const FALLBACK_RESPONSE =
  'I can help you explore Nepali cultural heritage or navigate HeritageGraph. Try asking about a specific monument, festival, deity, or Guthi — or say "take me to [section]" to navigate.';

export function getDummyResponse(input: string): {
  response: string;
  nav?: string;
} {
  const lower = input.toLowerCase();
  const match = DUMMY_RESPONSES.find((r) =>
    r.keywords.some((k) => lower.includes(k))
  );
  return match
    ? { response: match.response, nav: match.nav }
    : { response: FALLBACK_RESPONSE };
}
