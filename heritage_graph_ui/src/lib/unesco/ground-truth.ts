/**
 * UNESCO World Heritage ground truth for Nepal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────────
 * Neither of the platform's two data sources can supply these facts correctly:
 *
 *  1. The frozen demo corpus (`src/data/heritage-demo.json`) stamps
 *     `unescoStatus: "World Heritage Site (1979)"` onto seven *separate* nodes,
 *     including Nyatapola Temple — a structure inside the Bhaktapur Durbar
 *     Square monument zone, not a zone — and "Bhaktapur" the city, where the
 *     inscribed zone is Bhaktapur Durbar Square. It has no Hanuman Dhoka node
 *     at all. Its own `_provenance.textAuthorship` field is `"unrecorded"` and
 *     states that its descriptive fields "must not be cited".
 *
 *  2. The reviewed knowledge graph carries no UNESCO predicate whatsoever. Its
 *     only UNESCO content sits inside free-text `rdfs:comment` literals which
 *     likewise assert "UNESCO World Heritage Site." on individual monument
 *     zones (Changu Narayan, Pashupatinath, Boudhanath) and make an unverified
 *     intangible-heritage claim about Charya Nritya.
 *
 * So the UI must not derive UNESCO facts from either. Every value below is
 * transcribed by hand from the authoritative statement supplied for this work
 * and carries its own source note. Nothing here is inferred, rounded, or
 * completed from memory.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PRECISION RULE THIS FILE ENFORCES
 * ─────────────────────────────────────────────────────────────────────────────
 * Kathmandu Valley is ONE property inscribed as a serial nomination of SEVEN
 * monument zones. They are not seven World Heritage Sites. The type system
 * below makes the wrong statement hard to write: zones are reachable only
 * through `KATHMANDU_VALLEY.monumentZones`, never as top-level properties.
 *
 * Anything not stated below is not known to this module. Add nothing without
 * verifying it at https://whc.unesco.org and recording the source here.
 */

/** A property's inscription category on the World Heritage List. */
export type PropertyType = 'cultural' | 'natural';

/**
 * One of the seven monument zones that together make up the single
 * Kathmandu Valley property. Never render one of these as a standalone
 * "World Heritage Site".
 */
export interface MonumentZone {
  /** Stable key for i18n lookups and URL fragments. */
  readonly key: string;
  /**
   * The name as UNESCO uses it. Per the brief: "Bauddhanath" and "Swayambhu",
   * not the common transliterations.
   */
  readonly canonicalName: string;
  /**
   * Common alternative spellings. These exist so search and graph lookup can
   * match records stored under other transliterations. They are search keys —
   * never render one of these as the zone's title.
   */
  readonly aliases: readonly string[];
  /**
   * What the zone is, in UNESCO's own framing. Source: the ground-truth
   * statement for this work. Zones whose descriptor was not supplied carry
   * `null` rather than invented prose.
   */
  readonly descriptor: string | null;
}

export interface WorldHeritageProperty {
  readonly key: string;
  readonly name: string;
  readonly yearInscribed: number;
  readonly type: PropertyType;
  /** UNESCO selection criteria, as roman numerals. `null` when not supplied. */
  readonly criteria: readonly string[] | null;
  /** True when the property is inscribed as a serial nomination. */
  readonly serial: boolean;
  readonly monumentZones: readonly MonumentZone[] | null;
}

/**
 * The seven monument zones of the Kathmandu Valley property.
 *
 * SOURCE: ground-truth statement for this work — "Kathmandu Valley is
 * inscribed as a serial property of seven Monument Zones, confirmed by the
 * boundary modification accepted by the World Heritage Committee in 2006."
 *
 * Order follows the source statement.
 */
const KATHMANDU_VALLEY_ZONES: readonly MonumentZone[] = [
  {
    key: 'hanuman-dhoka',
    canonicalName: 'Hanuman Dhoka Durbar Square',
    aliases: ['Kathmandu Durbar Square', 'Basantapur Durbar Square', 'Hanuman Dhoka'],
    // SOURCE: ground truth names the zone and its city; no further descriptor
    // was supplied, so none is asserted.
    descriptor: null,
  },
  {
    key: 'patan-durbar-square',
    canonicalName: 'Patan Durbar Square',
    aliases: ['Lalitpur Durbar Square'],
    descriptor: null,
  },
  {
    key: 'bhaktapur-durbar-square',
    canonicalName: 'Bhaktapur Durbar Square',
    aliases: ['Bhadgaon Durbar Square'],
    descriptor: null,
  },
  {
    key: 'swayambhu',
    canonicalName: 'Swayambhu',
    aliases: ['Swayambhunath', 'Swayambhu Stupa', 'Swayambhunath Stupa'],
    // SOURCE: ground truth — "religious ensemble; includes the oldest Buddhist
    // stupa in the Valley".
    descriptor: 'religiousEnsembleOldestStupa',
  },
  {
    key: 'bauddhanath',
    canonicalName: 'Bauddhanath',
    aliases: ['Boudhanath', 'Boudha', 'Boudhanath Stupa'],
    // SOURCE: ground truth — "religious ensemble; includes the largest stupa
    // in Nepal".
    descriptor: 'religiousEnsembleLargestStupa',
  },
  {
    key: 'pashupati',
    canonicalName: 'Pashupati',
    aliases: ['Pashupatinath', 'Pashupatinath Temple'],
    // SOURCE: ground truth — "extensive Hindu temple precinct".
    descriptor: 'hinduTemplePrecinct',
  },
  {
    key: 'changu-narayan',
    canonicalName: 'Changu Narayan',
    aliases: ['Changunarayan', 'Changu Narayan Temple'],
    // SOURCE: ground truth — "traditional Newar settlement and Hindu temple
    // complex, with one of the earliest inscriptions in the Valley, from the
    // fifth century AD".
    descriptor: 'newarSettlementEarliestInscription',
  },
] as const;

/**
 * Kathmandu Valley — the first of Nepal's two cultural properties.
 *
 * SOURCE: ground-truth statement — inscribed 1979, cultural, criteria (iii),
 * (iv) and (vi), serial property of seven monument zones.
 */
export const KATHMANDU_VALLEY: WorldHeritageProperty = {
  key: 'kathmandu-valley',
  name: 'Kathmandu Valley',
  yearInscribed: 1979,
  type: 'cultural',
  criteria: ['iii', 'iv', 'vi'],
  serial: true,
  monumentZones: KATHMANDU_VALLEY_ZONES,
};

/**
 * All four Nepali properties on the World Heritage List — two cultural, two
 * natural.
 *
 * SOURCE: ground-truth statement for this work. The natural properties are
 * included deliberately: the entry experience is scoped to cultural heritage,
 * and silently omitting Sagarmatha and Chitwan would misrepresent the list.
 * They are shown with an explicit scope note rather than dropped.
 *
 * No criteria were supplied for the three properties other than Kathmandu
 * Valley, so they carry `null` rather than guessed values.
 */
export const NEPAL_WORLD_HERITAGE: readonly WorldHeritageProperty[] = [
  KATHMANDU_VALLEY,
  {
    key: 'sagarmatha-national-park',
    name: 'Sagarmatha National Park',
    yearInscribed: 1979,
    type: 'natural',
    criteria: null,
    serial: false,
    monumentZones: null,
  },
  {
    key: 'chitwan-national-park',
    name: 'Chitwan National Park',
    yearInscribed: 1984,
    type: 'natural',
    criteria: null,
    serial: false,
    monumentZones: null,
  },
  {
    key: 'lumbini',
    name: 'Lumbini, the Birthplace of the Lord Buddha',
    yearInscribed: 1997,
    type: 'cultural',
    criteria: null,
    serial: false,
    monumentZones: null,
  },
] as const;

/** The two cultural properties, in inscription order. */
export const CULTURAL_PROPERTIES: readonly WorldHeritageProperty[] =
  NEPAL_WORLD_HERITAGE.filter((p) => p.type === 'cultural');

/** The two natural properties — named in the scope statement, not detailed. */
export const NATURAL_PROPERTIES: readonly WorldHeritageProperty[] =
  NEPAL_WORLD_HERITAGE.filter((p) => p.type === 'natural');

export const LUMBINI: WorldHeritageProperty = NEPAL_WORLD_HERITAGE.find(
  (p) => p.key === 'lumbini',
)!;

/**
 * Kathmandu Valley's period on the List of World Heritage in Danger.
 *
 * SOURCE: ground-truth statement — "placed on the List of World Heritage in
 * Danger in 2003 and removed from that list in 2007."
 */
export const KATHMANDU_VALLEY_IN_DANGER = {
  listedYear: 2003,
  delistedYear: 2007,
} as const;

/** Total properties Nepal has on the World Heritage List. */
export const NEPAL_PROPERTY_COUNT = NEPAL_WORLD_HERITAGE.length; // 4
/** Monument zones within the single Kathmandu Valley property. */
export const KATHMANDU_VALLEY_ZONE_COUNT = KATHMANDU_VALLEY_ZONES.length; // 7

/**
 * Every name a zone may be stored under in the graph or the frozen corpus,
 * lower-cased, mapped back to its zone key.
 *
 * The reviewed graph holds these records fragmented across transliterations —
 * Bauddhanath alone appears as three separate subjects ("Boudhanath",
 * "Boudhanath Stupa" twice, under two different IRIs). This map is what lets
 * the UI recognise them as the same zone without asserting anything new.
 */
export const ZONE_LOOKUP: ReadonlyMap<string, MonumentZone> = new Map(
  KATHMANDU_VALLEY_ZONES.flatMap((zone) =>
    [zone.canonicalName, ...zone.aliases].map(
      (name) => [name.toLowerCase(), zone] as const,
    ),
  ),
);

/** Resolve a stored label to its monument zone, or `null` if it is not one. */
export function zoneForLabel(label: string | null | undefined): MonumentZone | null {
  if (!label) return null;
  return ZONE_LOOKUP.get(label.trim().toLowerCase()) ?? null;
}

/**
 * Guard used at render time. `unescoStatus` strings from the frozen corpus and
 * UNESCO claims inside graph `rdfs:comment` literals are both known to be
 * wrong (see the file header), so no surface may display them.
 *
 * Import this where you would otherwise be tempted to read `node.unescoStatus`.
 */
export const UNESCO_STATUS_FIELD_IS_UNRELIABLE = true as const;
