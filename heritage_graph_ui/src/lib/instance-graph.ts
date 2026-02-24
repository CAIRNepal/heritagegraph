/**
 * HeritageGraph — Live Instance Data Graph
 *
 * Fetches real heritage records from the backend API and builds
 * Cytoscape-compatible nodes + edges for the knowledge graph visualization.
 *
 * Unlike ontology-graph.ts (which shows the schema), this module shows
 * actual heritage data as interconnected nodes.
 */

/* ══════════════════════════════════════════════════════
 *  Types
 * ══════════════════════════════════════════════════════ */

export type InstanceCategory =
  | 'structure'
  | 'deity'
  | 'person'
  | 'location'
  | 'event'
  | 'ritual'
  | 'festival'
  | 'guthi'
  | 'monument'
  | 'iconography'
  | 'period'
  | 'tradition'
  | 'source';

export interface InstanceNode {
  id: string;
  label: string;
  category: InstanceCategory;
  entityType: string;
  description: string;
  apiEndpoint: string;
  rawData: Record<string, unknown>;
}

export interface InstanceEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  edgeType: 'relation' | 'location' | 'type_hierarchy';
}

export interface InstanceGraphData {
  nodes: InstanceNode[];
  edges: InstanceEdge[];
  isDemo?: boolean;
}

/* ══════════════════════════════════════════════════════
 *  Category colours — distinct from ontology schema colours
 * ══════════════════════════════════════════════════════ */

export const INSTANCE_CATEGORY_COLORS: Record<
  InstanceCategory,
  { bg: string; border: string; text: string; label: string; icon: string }
> = {
  structure:    { bg: '#3b82f6', border: '#2563eb', text: '#fff', label: 'Structures',    icon: '🏛️' },
  deity:        { bg: '#8b5cf6', border: '#7c3aed', text: '#fff', label: 'Deities',       icon: '🙏' },
  person:       { bg: '#10b981', border: '#059669', text: '#fff', label: 'People',         icon: '👤' },
  location:     { bg: '#06b6d4', border: '#0891b2', text: '#fff', label: 'Places',         icon: '📍' },
  event:        { bg: '#f59e0b', border: '#d97706', text: '#fff', label: 'Events',         icon: '📅' },
  ritual:       { bg: '#ef4444', border: '#dc2626', text: '#fff', label: 'Rituals',        icon: '🔥' },
  festival:     { bg: '#f97316', border: '#ea580c', text: '#fff', label: 'Festivals',      icon: '🎉' },
  guthi:        { bg: '#14b8a6', border: '#0d9488', text: '#fff', label: 'Guthis',         icon: '🏘️' },
  monument:     { bg: '#6366f1', border: '#4f46e5', text: '#fff', label: 'Monuments',      icon: '🗿' },
  iconography:  { bg: '#ec4899', border: '#db2777', text: '#fff', label: 'Iconography',    icon: '🎨' },
  period:       { bg: '#84cc16', border: '#65a30d', text: '#fff', label: 'Periods',        icon: '⏳' },
  tradition:    { bg: '#a855f7', border: '#9333ea', text: '#fff', label: 'Traditions',     icon: '📜' },
  source:       { bg: '#78716c', border: '#57534e', text: '#fff', label: 'Sources',        icon: '📚' },
};

/* ══════════════════════════════════════════════════════
 *  API endpoint registry
 * ══════════════════════════════════════════════════════ */

interface EntityConfig {
  endpoint: string;
  category: InstanceCategory;
  entityType: string;
  nameField: string;
  descriptionField: string;
  /** Fields that can create edges to other entities (by name matching) */
  relationFields: { field: string; label: string; targetCategory?: InstanceCategory }[];
  /** Fields that hold a location name (creates edge to location nodes) */
  locationField?: string;
}

const ENTITY_CONFIGS: EntityConfig[] = [
  {
    endpoint: '/cidoc/structures/',
    category: 'structure',
    entityType: 'ArchitecturalStructure',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'structure_type', label: 'type' },
      { field: 'architectural_style', label: 'style' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/deities/',
    category: 'deity',
    entityType: 'Deity',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'religious_tradition', label: 'tradition' },
    ],
  },
  {
    endpoint: '/cidoc/persons/',
    category: 'person',
    entityType: 'Person',
    nameField: 'name',
    descriptionField: 'biography',
    relationFields: [
      { field: 'occupation', label: 'occupation' },
    ],
  },
  {
    endpoint: '/cidoc/locations/',
    category: 'location',
    entityType: 'Location',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [
      { field: 'type', label: 'type' },
    ],
  },
  {
    endpoint: '/cidoc/events/',
    category: 'event',
    entityType: 'Event',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [
      { field: 'type', label: 'event_type' },
    ],
  },
  {
    endpoint: '/cidoc/rituals/',
    category: 'ritual',
    entityType: 'RitualEvent',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'ritual_type', label: 'ritual_type' },
      { field: 'performed_by', label: 'performed_by', targetCategory: 'person' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/festivals/',
    category: 'festival',
    entityType: 'Festival',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'festival_type', label: 'festival_type' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/guthis/',
    category: 'guthi',
    entityType: 'Guthi',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'guthi_type', label: 'guthi_type' },
    ],
    locationField: 'location',
  },
  {
    endpoint: '/cidoc/monuments/',
    category: 'monument',
    entityType: 'BuddhistMonument',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'monument_type', label: 'monument_type' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/iconographic_objects/',
    category: 'iconography',
    entityType: 'IconographicObject',
    nameField: 'name',
    descriptionField: 'note',
    relationFields: [
      { field: 'object_type', label: 'object_type' },
      { field: 'depicts_deity', label: 'depicts', targetCategory: 'deity' },
      { field: 'technique', label: 'technique' },
    ],
    locationField: 'location_name',
  },
  {
    endpoint: '/cidoc/historical_periods/',
    category: 'period',
    entityType: 'HistoricalPeriod',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [],
  },
  {
    endpoint: '/cidoc/traditions/',
    category: 'tradition',
    entityType: 'Tradition',
    nameField: 'name',
    descriptionField: 'description',
    relationFields: [
      { field: 'type', label: 'tradition_type' },
    ],
  },
  {
    endpoint: '/cidoc/sources/',
    category: 'source',
    entityType: 'Source',
    nameField: 'title',
    descriptionField: 'authors',
    relationFields: [
      { field: 'type', label: 'source_type' },
    ],
  },
];

/* ══════════════════════════════════════════════════════
 *  Demo / Seed Data — Kathmandu Valley Heritage
 *  Used when backend is empty or unreachable.
 *  Based on real CSV fixtures in heritage_graph/fixtures/
 * ══════════════════════════════════════════════════════ */

const DEMO_DATA: Record<string, { config: EntityConfig; data: Record<string, unknown>[] }> = {
  persons: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'person')!,
    data: [
      { id: 1, name: 'Arniko', description: 'Newar architect from Patan who traveled to Yuan Dynasty China and introduced pagoda architecture to China and Tibet.', aliases: 'Araniko; Balabahu', birth_date: '1245 CE', death_date: '1306 CE', occupation: 'Architect; Sculptor' },
      { id: 2, name: 'Bhimsen Thapa', description: "Nepal's first powerful Prime Minister. Built Dharahara tower and maintained sovereignty during British expansion.", birth_date: '1775 CE', death_date: '1839 CE', occupation: 'Prime Minister; Military Commander' },
      { id: 3, name: 'Pratap Malla', description: 'Malla king and polyglot poet of Kathmandu. Erected the Hanuman Dhoka inscription in 15 languages.', birth_date: 'c. 1624 CE', death_date: '1674 CE', occupation: 'King; Poet; Patron of Arts' },
      { id: 4, name: 'Jaya Sthiti Malla', description: 'Medieval Malla king who unified the three kingdoms and codified the Newar caste system.', birth_date: 'c. 1340 CE', death_date: '1395 CE', occupation: 'King; Lawgiver' },
      { id: 5, name: 'Amshuverma', description: 'Lichhavi king who forged Nepal-Tibet ties. Built Kailaskut palace and married daughter Bhrikuti to Tibetan king.', birth_date: 'c. 565 CE', death_date: 'c. 621 CE', occupation: 'King; Diplomat' },
      { id: 6, name: 'Laxmi Prasad Devkota', description: "Mahakavi — the greatest Nepali poet. Wrote 'Muna Madan'.", birth_date: '1909 CE', death_date: '1959 CE', occupation: 'Poet; Author' },
      { id: 7, name: 'Bhrikuti', description: 'Lichhavi princess who brought Buddhism to Tibet. Revered as Green Tara in Tibetan tradition.', birth_date: 'c. 600 CE', death_date: 'c. 649 CE', occupation: 'Princess; Buddhist Patron' },
      { id: 8, name: 'Siddhidas Mahaju', description: 'Father of modern Nepal Bhasa poetry. Wrote during a period of linguistic suppression.', birth_date: '1867 CE', death_date: '1930 CE', occupation: 'Poet; Social Reformer' },
      { id: 9, name: 'Yogbir Singh Kansakar', description: 'Newar social reformer and anti-Rana activist who fought for caste equality.', birth_date: '1886 CE', death_date: '1941 CE', occupation: 'Philanthropist; Activist' },
      { id: 10, name: 'Chunda Vajracharya', description: 'Pioneer of Newar metalwork tradition. Legendary sculptor whose lineage created finest bronze works.', birth_date: 'c. 7th century CE', occupation: 'Sculptor; Metal Artisan' },
    ],
  },
  locations: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'location')!,
    data: [
      { id: 1, name: 'Kathmandu Durbar Square', type: 'monument', description: 'Royal palace complex. UNESCO World Heritage Site featuring Hanuman Dhoka Palace, Taleju Temple, and Kumari Ghar.', coordinates: '27.7045, 85.3077', current_status: 'partially_ruined' },
      { id: 2, name: 'Patan Durbar Square', type: 'monument', description: 'Historic royal palace in Lalitpur. Houses Patan Museum, Krishna Mandir, and Golden Temple. UNESCO WHS.', coordinates: '27.6726, 85.3254', current_status: 'partially_ruined' },
      { id: 3, name: 'Bhaktapur Durbar Square', type: 'monument', description: 'Best-preserved medieval town center. Features 55-Window Palace and Nyatapola Temple. UNESCO WHS.', coordinates: '27.6710, 85.4283', current_status: 'partially_ruined' },
      { id: 4, name: 'Swayambhunath', type: 'temple', description: 'Ancient Buddhist stupa. Known as the Monkey Temple. One of the oldest religious sites in Nepal.', coordinates: '27.7149, 85.2903', current_status: 'preserved' },
      { id: 5, name: 'Boudhanath Stupa', type: 'temple', description: 'One of the largest spherical stupas in the world. Center of Tibetan Buddhism in Nepal. UNESCO WHS.', coordinates: '27.7215, 85.3620', current_status: 'preserved' },
      { id: 6, name: 'Pashupatinath Temple', type: 'temple', description: "Sacred Hindu temple on Bagmati River banks. Nepal's most sacred Hindu site. UNESCO WHS.", coordinates: '27.7109, 85.3487', current_status: 'preserved' },
      { id: 7, name: 'Changu Narayan Temple', type: 'temple', description: 'Oldest Hindu temple in the Valley, 4th century CE. Renowned for Lichhavi-era sculptures. UNESCO WHS.', coordinates: '27.7178, 85.4280', current_status: 'preserved' },
      { id: 8, name: 'Lumbini', type: 'archaeological_site', description: 'Birthplace of Lord Buddha. Mayadevi Temple and Ashoka Pillar. UNESCO WHS.', coordinates: '27.4833, 83.2767', current_status: 'preserved' },
      { id: 9, name: 'Kirtipur', type: 'city', description: 'Ancient Newar hilltop city. Known for Bagh Bhairav Temple and fierce resistance during unification.', coordinates: '27.6792, 85.2781', current_status: 'partially_ruined' },
      { id: 10, name: 'Nuwakot Durbar', type: 'monument', description: "Fortified palace by Prithvi Narayan Shah. Strategic stronghold during Nepal's unification.", coordinates: '27.9120, 85.1635', current_status: 'partially_ruined' },
      { id: 11, name: 'Thimi', type: 'city', description: 'Ancient Newar town famous for pottery, mask-making, and Bisket Jatra celebrations.', coordinates: '27.6817, 85.3883', current_status: 'preserved' },
      { id: 12, name: 'Sankhu', type: 'city', description: 'One of the oldest settlements in the Valley. Known for Bajrayogini Temple. Damaged in 2015.', coordinates: '27.7564, 85.4661', current_status: 'partially_ruined' },
    ],
  },
  deities: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'deity')!,
    data: [
      { id: 1, name: 'Taleju Bhawani', description: 'Tutelary goddess of the Malla kings. Temples in all three Durbar Squares.', religious_tradition: 'Hindu', alternate_names: 'Taleju, Tulaja Devi' },
      { id: 2, name: 'Machhindranath', description: 'Rain god and patron deity of the Valley. Worshipped by both Hindus and Buddhists.', religious_tradition: 'Syncretic', alternate_names: 'Rato Machindranath, Bunga Dyo, Lokeshwor' },
      { id: 3, name: 'Bhairav', description: 'Fierce manifestation of Shiva. Multiple forms guard different parts of the Valley.', religious_tradition: 'Hindu', alternate_names: 'Akash Bhairav, Kal Bhairav, Swet Bhairav' },
      { id: 4, name: 'Kumari', description: 'Living goddess, incarnation of Taleju. Pre-pubescent Newar girl selected through rigorous tests.', religious_tradition: 'Hindu; Buddhist', alternate_names: 'Royal Kumari, Dyah Meju' },
      { id: 5, name: 'Manjushri', description: 'Bodhisattva of wisdom. Legend says he drained the ancient lake creating the Kathmandu Valley.', religious_tradition: 'Buddhist', alternate_names: 'Manjushree, Jampayang' },
      { id: 6, name: 'Ganesh', description: 'Elephant-headed god of beginnings. Four protective shrines mark cardinal directions of Kathmandu.', religious_tradition: 'Hindu', alternate_names: 'Ganesa, Binayak, Vinayaka' },
      { id: 7, name: 'White Tara', description: 'Female Bodhisattva of compassion. Identified with princess Bhrikuti.', religious_tradition: 'Buddhist', alternate_names: 'Sita Tara, Sgrol-dkar' },
      { id: 8, name: 'Pashupatinath', description: "Supreme form of Shiva as Lord of Animals. Main deity of Nepal's most sacred Hindu temple.", religious_tradition: 'Hindu', alternate_names: 'Pashupati, Mahadev, Shiva' },
    ],
  },
  structures: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'structure')!,
    data: [
      { id: 1, name: 'Nyatapola Temple', structure_type: 'Temple', architectural_style: 'Pagoda', construction_date: '1702 CE', location_name: 'Bhaktapur Durbar Square', description: "Five-story pagoda — the tallest in Nepal. Built by King Bhupatindra Malla. Survived 1934 and 2015 earthquakes.", existence_status: 'Extant', condition: 'Good' },
      { id: 2, name: 'Krishna Mandir', structure_type: 'Temple', architectural_style: 'Shikhara', construction_date: '1637 CE', location_name: 'Patan Durbar Square', description: 'Stone shikhara-style temple dedicated to Krishna. 21 golden spires and Mahabharata friezes.', existence_status: 'Extant', condition: 'Good' },
      { id: 3, name: 'Kasthamandap', structure_type: 'Pati', architectural_style: 'Pagoda', construction_date: 'c. 12th century CE', location_name: 'Kathmandu Durbar Square', description: 'Legendary rest house from a single tree. Gave Kathmandu its name. Collapsed 2015, reconstruction ongoing.', existence_status: 'Destroyed', condition: 'Ruinous' },
      { id: 4, name: 'Dharahara', structure_type: 'Other', architectural_style: 'Mughal', construction_date: '1832 CE', location_name: 'Central Kathmandu', description: 'Nine-story watchtower built by Bhimsen Thapa. Collapsed 2015. Rebuilt 2021.', existence_status: 'Restored', condition: 'Good' },
      { id: 5, name: '55-Window Palace', structure_type: 'Sattal', architectural_style: 'Pagoda', construction_date: '1427 CE', location_name: 'Bhaktapur Durbar Square', description: 'Royal palace known for its 55 intricately carved windows. Houses National Art Gallery.', existence_status: 'Extant', condition: 'Fair' },
      { id: 6, name: 'Golden Gate (Sun Dhoka)', structure_type: 'Other', architectural_style: 'Mixed', construction_date: '1753 CE', location_name: 'Bhaktapur Durbar Square', description: 'Gilt copper gate — finest metalwork in the Valley. Features Garuda, nagas, and Taleju.', existence_status: 'Extant', condition: 'Excellent' },
      { id: 7, name: 'Bagh Bhairav Temple', structure_type: 'Temple', architectural_style: 'Pagoda', construction_date: 'c. 16th century CE', location_name: 'Kirtipur', description: 'Temple dedicated to the tiger form of Bhairav. Walls covered with Gorkha conquest weapons.', existence_status: 'Extant', condition: 'Fair' },
      { id: 8, name: 'Rani Pokhari', structure_type: 'Pokhari', architectural_style: 'Rana_Neoclassical', construction_date: '1670 CE', location_name: 'Central Kathmandu', description: 'Artificial pond built by Pratap Malla in memory of his son. Restored after 2015.', existence_status: 'Restored', condition: 'Good' },
      { id: 9, name: 'Patan Museum', structure_type: 'Sattal', architectural_style: 'Pagoda', construction_date: 'c. 14th century CE', location_name: 'Patan Durbar Square', description: "Former royal residence, now South Asia's finest bronze collection. Austrian-restored.", existence_status: 'Extant', condition: 'Excellent' },
      { id: 10, name: 'Mayadevi Temple', structure_type: 'Temple', architectural_style: 'Other', construction_date: 'c. 3rd century BCE', location_name: 'Lumbini', description: "Temple at the exact birthplace of Buddha. Pre-Ashokan brick structures found.", existence_status: 'Restored', condition: 'Good' },
    ],
  },
  events: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'event')!,
    data: [
      { id: 1, name: 'Indra Jatra', type: 'festival', description: "Eight-day festival honoring Indra. Features Kumari's chariot procession and Lakhe dances.", start_date: 'Bhadra/Ashwin (Sep)', recurrence: 'annual' },
      { id: 2, name: 'Bisket Jatra', type: 'festival', description: 'Nepali New Year festival in Bhaktapur. Massive chariot tug-of-war and tongue-piercing ritual.', start_date: 'Baisakh 1 (mid-Apr)', recurrence: 'annual' },
      { id: 3, name: 'Dashain', type: 'festival', description: "Longest Hindu festival in Nepal. Celebrates Durga's victory. Involves tika and jamara.", start_date: 'Ashwin/Kartik (Sep-Oct)', recurrence: 'annual' },
      { id: 4, name: 'Tihar', type: 'festival', description: 'Five-day festival of lights. Includes Laxmi Puja and Newar New Year (Mha Puja).', start_date: 'Kartik (Oct-Nov)', recurrence: 'annual' },
      { id: 5, name: 'Gorkha Unification Campaign', type: 'historical', description: "Prithvi Narayan Shah's campaign to unify Nepal. Began with siege of the Kathmandu Valley.", start_date: '1743 CE', end_date: '1769 CE', recurrence: 'one_time' },
      { id: 6, name: '1934 Bihar-Nepal Earthquake', type: 'historical', description: '8.0 magnitude earthquake. Destroyed Dharahara, damaged Bhaktapur, killed 8500+ in Nepal.', start_date: 'January 15 1934', recurrence: 'one_time' },
      { id: 7, name: '2015 Gorkha Earthquake', type: 'historical', description: '7.8 magnitude earthquake. Damaged 750,000 structures including Dharahara and Durbar Squares.', start_date: 'April 25 2015', recurrence: 'one_time' },
      { id: 8, name: 'Rato Machindranath Jatra', type: 'festival', description: 'Longest chariot festival in Patan. The rain deity is pulled through Patan for weeks.', start_date: 'Baisakh (Apr-May)', recurrence: 'annual' },
      { id: 9, name: 'Ghode Jatra', type: 'ceremony', description: 'Horse racing festival at Tundikhel. Legend says galloping keeps a demon underground.', start_date: 'Chaitra (Mar-Apr)', recurrence: 'annual' },
      { id: 10, name: 'Mha Puja', type: 'ceremony', description: 'Newar New Year self-worship ceremony. Mandala circle rituals to purify the self.', start_date: 'Kartik Amavasya (Oct-Nov)', recurrence: 'annual' },
    ],
  },
  festivals: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'festival')!,
    data: [
      { id: 1, name: 'Bisket Jatra (Festival)', festival_type: 'ChariotFestival', description: 'Nepali New Year in Bhaktapur. Chariot tug-of-war and lingo pole raising.', date: 'Baisakh 1', duration: '9 days', location_name: 'Bhaktapur' },
      { id: 2, name: 'Rato Machindranath Jatra (Festival)', festival_type: 'ChariotFestival', description: 'Longest chariot festival. Rain deity pulled through Patan.', date: 'Baisakh-Jestha', duration: '4-6 weeks', location_name: 'Patan (Lalitpur)' },
      { id: 3, name: 'Seto Machindranath Jatra', festival_type: 'ChariotFestival', description: 'White Machindranath chariot festival in Kathmandu.', date: 'Chaitra (Mar-Apr)', duration: '3 days', location_name: 'Kathmandu' },
      { id: 4, name: 'Gai Jatra', festival_type: 'MaskedDance', description: 'Festival of the Sacred Cow. Satirical performances mocking society.', date: 'Bhadra (Aug-Sep)', duration: '1-2 days', location_name: 'Kathmandu Valley cities' },
      { id: 5, name: 'Indra Jatra (Festival)', festival_type: 'Jatra', description: 'Eight-day festival honoring Indra. Kumari chariot and Lakhe dance.', date: 'Bhadra/Ashwin', duration: '8 days', location_name: 'Kathmandu' },
      { id: 6, name: 'Yenya Punhi', festival_type: 'Jatra', description: 'Ancient name for Indra Jatra. Ceremonial pole at Hanuman Dhoka.', date: 'Bhadra/Ashwin', duration: '8 days', location_name: 'Kathmandu' },
      { id: 7, name: 'Machindranath Snan', festival_type: 'Jatra', description: 'Bathing ceremony of Rato Machindranath before chariot festival.', date: 'Chaitra', duration: '1 day', location_name: 'Patan (Lalitpur)' },
      { id: 8, name: 'Bhoto Jatra', festival_type: 'Jatra', description: 'Finale of Rato Machindranath Jatra. Sacred jeweled vest displayed.', date: 'Jestha', duration: '1 day', location_name: 'Jawalakhel (Lalitpur)' },
    ],
  },
  rituals: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'ritual')!,
    data: [
      { id: 1, name: 'Kumari Puja', ritual_type: 'Puja', description: 'Worship of the Royal Kumari during Indra Jatra. Kumari carried in golden palanquin.', location_name: 'Kathmandu Durbar Square', performed_by: 'Kumari priests (Vajracharya)' },
      { id: 2, name: 'Samyak', ritual_type: 'Puja', description: 'Grand Buddhist festival — hundreds of Buddha statues displayed in public squares.', location_name: 'Patan Durbar Square', performed_by: 'Buddhist communities (Shakya/Vajracharya)' },
      { id: 3, name: 'Matya', ritual_type: 'Jatra', description: 'Buddhist pilgrimage circuit visiting 150+ shrines in Patan in one day.', location_name: 'Patan (Lalitpur)', performed_by: 'Newar Buddhist communities' },
      { id: 4, name: 'Navami Puja at Taleju', ritual_type: 'Puja', description: 'Secret tantric worship of Taleju during Dashain. Only day inner sanctum is public.', location_name: 'Kathmandu Durbar Square', performed_by: 'Karmacharya priests' },
      { id: 5, name: 'Shraddha Ceremony', ritual_type: 'Shraddha', description: 'Ancestral rites at Pashupatinath. Offerings to deceased family.', location_name: 'Pashupatinath Temple', performed_by: 'Hindu Brahmin priests' },
      { id: 6, name: 'Homa at Swayambhu', ritual_type: 'Homa', description: 'Fire ritual by Vajracharya priests at Swayambhunath. Ghee and grain offerings.', location_name: 'Swayambhunath', performed_by: 'Vajracharya priests' },
      { id: 7, name: 'Ihi (Bel Bibaha)', ritual_type: 'Diksha', description: "Pre-puberty initiation for Newar girls. Girl 'married' to bel fruit (Vishnu).", location_name: 'Community hall', performed_by: 'Senior women and Brahmin priests' },
    ],
  },
  guthis: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'guthi')!,
    data: [
      { id: 1, name: 'Guthi of Rato Machindranath', guthi_type: 'Devi_Guthi', description: 'Manages the Rato Machindranath Jatra, one of the longest chariot processions.', location: 'Patan (Lalitpur)', managed_structures: 'Rato Machindranath Temple' },
      { id: 2, name: 'Taleju Guthi', guthi_type: 'Devi_Guthi', description: 'Manages worship and rituals of Taleju Bhawani. Controls inner sanctum access.', location: 'Kathmandu Durbar Square', managed_structures: 'Taleju Temple' },
      { id: 3, name: 'Nani Guthi of Bhaktapur', guthi_type: 'Nani_Guthi', description: 'Musical Guthi organizing traditional Newar music during Bisket Jatra.', location: 'Bhaktapur', managed_structures: 'Dattatreya Temple courtyard' },
      { id: 4, name: 'Pashupatinath Raj Guthi', guthi_type: 'Raj_Guthi', description: 'Royal trust managing Pashupatinath Temple — most sacred Hindu site.', location: 'Deopatan', managed_structures: 'Pashupatinath Temple' },
      { id: 5, name: 'Si Guthi of Kwabahal', guthi_type: 'Si_Guthi', description: 'Funeral trust for Kwabahal neighborhood. Ensures proper death rituals.', location: 'Patan (Lalitpur)' },
      { id: 6, name: 'Manka Guthi of Thimi', guthi_type: 'Manka_Guthi', description: 'Agricultural trust managing communal farmlands and harvest festivals.', location: 'Thimi' },
    ],
  },
  historical_periods: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'period')!,
    data: [
      { id: 1, name: 'Kirant Period', start_year: 'c. 800 BCE', end_year: 'c. 300 CE', description: 'Early period ruled by Kirant dynasty. Associated with Mahabharata era.' },
      { id: 2, name: 'Lichhavi Period', start_year: 'c. 400 CE', end_year: 'c. 750 CE', description: 'Golden age of Nepali art and architecture. Masterful stone sculptures.' },
      { id: 3, name: 'Thakuri Period', start_year: 'c. 750 CE', end_year: 'c. 1200 CE', description: 'Transitional period. Political fragmentation but continued cultural development.' },
      { id: 4, name: 'Early Malla Period', start_year: '1200 CE', end_year: '1482 CE', description: 'Codification of laws, development of Newar arts, major temples built.' },
      { id: 5, name: 'Late Malla Period', start_year: '1482 CE', end_year: '1769 CE', description: 'Three competing kingdoms drove explosion of art and architecture. Most Durbar Square temples from this era.' },
      { id: 6, name: 'Shah Period', start_year: '1769 CE', end_year: '1846 CE', description: "Prithvi Narayan Shah unified Nepal. Expanded territory but political instability." },
      { id: 7, name: 'Rana Period', start_year: '1846 CE', end_year: '1951 CE', description: 'Hereditary prime ministers ruled. Neoclassical palaces built but traditional arts declined.' },
      { id: 8, name: 'Modern Period', start_year: '1951 CE', end_year: 'present', description: 'Democratic era. Jana Andolan movements and Federal Republic established 2008.' },
    ],
  },
  iconographic_objects: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'iconography')!,
    data: [
      { id: 1, name: 'Vishwarupa Vishnu of Changu Narayan', object_type: 'Murti', description: 'Monumental stone Vishnu in universal form. Finest Lichhavi-era sculpture.', depicts_deity: 'Vishnu', creation_date: 'c. 5th century CE', location_name: 'Changu Narayan Temple' },
      { id: 2, name: 'Paubha of Vasudhara', object_type: 'Paubha', description: 'Scroll painting of Vasudhara, Buddhist goddess of wealth. Classic Newar Paubha art.', depicts_deity: 'Vasudhara', creation_date: 'c. 15th century CE', location_name: 'Patan Museum' },
      { id: 3, name: 'Kal Bhairav Stone Image', object_type: 'Murti', description: 'Massive stone Kal Bhairav at Durbar Square. Liars before it said to vomit blood.', depicts_deity: 'Bhairav', creation_date: 'c. 17th century CE', location_name: 'Kathmandu Durbar Square' },
      { id: 4, name: 'Uma-Maheshwar Relief', object_type: 'Murti', description: 'Masterpiece showing Shiva and Parvati on Kailash. Multiple Valley copies.', depicts_deity: 'Shiva and Parvati', creation_date: 'c. 6th century CE', location_name: 'National Museum' },
      { id: 5, name: 'Golden Taleju Image', object_type: 'Murti', description: 'Gold-plated copper Taleju Bhawani inside Taleju Temple sanctum.', depicts_deity: 'Taleju Bhawani', creation_date: 'c. 16th century CE', location_name: 'Kathmandu Durbar Square' },
      { id: 6, name: 'Sleeping Vishnu of Budhanilkantha', object_type: 'Murti', description: '5-meter reclining Vishnu in water tank. Largest stone sculpture in Nepal.', depicts_deity: 'Vishnu', creation_date: 'c. 7th-8th century CE', location_name: 'Budhanilkantha Temple' },
      { id: 7, name: 'Paubha of Green Tara', object_type: 'Paubha', description: 'Exquisite scroll painting of Green Tara. Fine gold line work.', depicts_deity: 'Green Tara', creation_date: 'c. 13th century CE', location_name: 'Los Angeles County Museum of Art' },
      { id: 8, name: 'Garuda Statue at Changu Narayan', object_type: 'Murti', description: 'Kneeling Garuda in namaste. Important Lichhavi-era bronze casting.', depicts_deity: 'Garuda', creation_date: 'c. 5th century CE', location_name: 'Changu Narayan Temple' },
    ],
  },
  monuments: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'monument')!,
    data: [
      { id: 1, name: 'Swayambhunath Stupa', monument_type: 'Stupa', description: 'Ancient hilltop stupa with iconic Buddha eyes. Origin legends linked to Manjushri.', construction_date: 'c. 5th century CE', location_name: 'Swayambhunath' },
      { id: 2, name: 'Boudhanath Stupa', monument_type: 'Stupa', description: 'Largest stupa. Mandala-shaped with 13 rings for path to enlightenment.', construction_date: 'c. 14th century CE', location_name: 'Boudhanath Stupa' },
      { id: 3, name: 'Ashoka Stupa (Patan)', monument_type: 'Stupa', description: 'One of four stupas by Emperor Ashoka, 249 BCE. Marks boundary of ancient Patan.', construction_date: 'c. 3rd century BCE', location_name: 'Patan (Lalitpur)' },
      { id: 4, name: 'Chilancho Stupa', monument_type: 'Stupa', description: 'Buddhist stupa in Kirtipur with carved stone panels of Buddha life.', construction_date: 'c. 15th century CE', location_name: 'Kirtipur' },
      { id: 5, name: 'Charumati Vihara Stupa', monument_type: 'Stupa', description: "Stupa attributed to Princess Charumati (Ashoka's daughter). Oldest Buddhist site.", construction_date: 'c. 3rd century BCE', location_name: 'Chabahil Kathmandu' },
      { id: 6, name: 'Mahaboudha Chaitya', monument_type: 'Chaitya', description: 'Terracotta temple covered with Buddha-image tiles. Inspired by Bodh Gaya.', construction_date: '1585 CE', location_name: 'Patan Durbar Square' },
      { id: 7, name: 'Kathe Simbhu Stupa', monument_type: 'Stupa', description: 'Swayambhunath replica in central Kathmandu. Popular urban Buddhist shrine.', construction_date: 'c. medieval period', location_name: 'Kathmandu' },
      { id: 8, name: 'Dhando Chaitya', monument_type: 'Chaitya', description: 'Lichhavi-era stone chaitya with detailed carved Buddha panels.', construction_date: 'c. 6th century CE', location_name: 'Kathmandu' },
    ],
  },
  traditions: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'tradition')!,
    data: [
      { id: 1, name: 'Kumari Worship', type: 'ritual', description: 'Living goddess tradition. Pre-pubescent Newar girl selected as incarnation of Taleju.', associated_materials: 'Ceremonial palanquin, red dress, golden crown' },
      { id: 2, name: 'Newari Metalwork', type: 'craft', description: 'Traditional lost-wax casting and repoussé metalwork producing bronze statues and temple ornaments.', associated_materials: 'Copper, bronze, gold, beeswax, clay molds' },
      { id: 3, name: 'Thangka Painting', type: 'craft', description: 'Buddhist scroll painting depicting mandalas and deities. Paubha is the Newar variant.', associated_materials: 'Mineral pigments, gold leaf, cotton canvas' },
      { id: 4, name: 'Deusi Bhailo', type: 'music', description: 'Traditional singing and dancing during Tihar. Door-to-door performances for gifts.', associated_materials: 'Madal drum, jhyali cymbals' },
      { id: 5, name: 'Dhime Dance', type: 'dance', description: 'Traditional Newar dance to Dhime drum. Integral to festivals and processions.', associated_materials: 'Dhime drum, bhusyah cymbals' },
      { id: 6, name: 'Charya Nritya', type: 'dance', description: 'Sacred Buddhist tantric dance by Vajracharya priests. UNESCO Intangible Heritage candidate.', associated_materials: 'Ritual crown, silk robes, sacred masks' },
      { id: 7, name: 'Jyapu Farming Traditions', type: 'craft', description: 'Agricultural practices of Jyapu caste. Unique rice cultivation and seasonal rituals.', associated_materials: 'Traditional wooden plough, sickle' },
      { id: 8, name: 'Lakhe Dance', type: 'dance', description: 'Masked demon dance during Indra Jatra. Red mask dancer chases children through streets.', associated_materials: 'Red demon mask, ankle bells, Dhime drum' },
    ],
  },
  sources: {
    config: ENTITY_CONFIGS.find((c) => c.category === 'source')!,
    data: [
      { id: 1, title: 'Nepal Mandala: A Cultural Study of the Kathmandu Valley', authors: 'Mary Slusser', type: 'book', publication_year: '1982', description: 'Comprehensive cultural study of the Kathmandu Valley' },
      { id: 2, title: 'The Art of Nepal', authors: 'Pratapaditya Pal', type: 'book', publication_year: '1985', description: 'Survey of Nepali art traditions' },
      { id: 3, title: 'Kathmandu Valley: The Preservation Challenge', authors: 'UNESCO', type: 'journal', publication_year: '2007', description: 'UNESCO preservation study' },
      { id: 4, title: 'Lichhavi Inscriptions of Nepal', authors: 'D.R. Regmi', type: 'book', publication_year: '1983', description: 'Scholarly compilation of Lichhavi-era stone inscriptions' },
      { id: 5, title: 'Medieval Nepal: History of Architecture and Art', authors: 'Wolfgang Korn', type: 'book', publication_year: '1976', description: 'Architectural and art history of medieval Nepal' },
      { id: 6, title: 'Festivals of Nepal', authors: 'Mary Anderson', type: 'book', publication_year: '1971', description: 'Comprehensive survey of Nepali festivals' },
      { id: 7, title: 'Heritage Recovery in Nepal after the 2015 Earthquake', authors: 'Robin Coningham', type: 'journal', publication_year: '2019', description: 'Post-earthquake heritage recovery assessment' },
      { id: 8, title: 'Living with the Gods: Newar Religion', authors: 'Gérard Toffin', type: 'book', publication_year: '2007', description: 'Ethnographic study of Newar religious practices' },
      { id: 9, title: 'The Traditional Architecture of the Kathmandu Valley', authors: 'John Sanday', type: 'book', publication_year: '2001', description: 'Architectural survey and preservation guide' },
      { id: 10, title: 'Nepal: Growth of a Nation', authors: 'Ludwig Stiller', type: 'book', publication_year: '1993', description: 'Historical narrative of Nepal as a nation' },
      { id: 11, title: 'The Newar Merchants of Lhasa', authors: 'Christoph von Fürer-Haimendorf', type: 'journal', publication_year: '1975', description: 'Study of Newar trade networks with Tibet' },
      { id: 12, title: 'Inventory of Stone Inscriptions of the Kathmandu Valley', authors: 'Dhanavajra Vajracharya', type: 'archive', publication_year: '1973', description: 'Catalogued collection of stone inscriptions' },
    ],
  },
};

/**
 * Build graph data from the built-in demo dataset.
 * Creates rich semantic edges based on domain knowledge of Kathmandu Valley heritage.
 */
function buildDemoGraphData(): InstanceGraphData {
  const nodes: InstanceNode[] = [];
  const nodeIdSet = new Set<string>();

  // Create all nodes
  for (const [, { config, data }] of Object.entries(DEMO_DATA)) {
    for (const item of data) {
      const id = `${config.category}_${item.id}`;
      const name = String(item[config.nameField] || `Unnamed ${config.entityType}`);
      const desc = String(item[config.descriptionField] || '');

      if (nodeIdSet.has(id)) continue;
      nodeIdSet.add(id);

      nodes.push({
        id,
        label: name,
        category: config.category,
        entityType: config.entityType,
        description: desc.slice(0, 300),
        apiEndpoint: config.endpoint,
        rawData: item,
      });
    }
  }

  /* ── Explicit semantic edges ──
   * Each tuple: [sourceId, targetId, label, edgeType]
   * Based on domain knowledge from the CSV fixture descriptions.
   */
  const semanticEdges: [string, string, string, 'relation' | 'location'][] = [
    // ─── Structures → Locations (located_at) ───
    ['structure_1',  'location_3',  'located_at',       'location'],   // Nyatapola → Bhaktapur Durbar Square
    ['structure_2',  'location_2',  'located_at',       'location'],   // Krishna Mandir → Patan Durbar Square
    ['structure_3',  'location_1',  'located_at',       'location'],   // Kasthamandap → Kathmandu Durbar Square
    ['structure_5',  'location_3',  'located_at',       'location'],   // 55-Window Palace → Bhaktapur Durbar Square
    ['structure_6',  'location_3',  'located_at',       'location'],   // Golden Gate → Bhaktapur Durbar Square
    ['structure_7',  'location_9',  'located_at',       'location'],   // Bagh Bhairav → Kirtipur
    ['structure_9',  'location_2',  'located_at',       'location'],   // Patan Museum → Patan Durbar Square
    ['structure_10', 'location_8',  'located_at',       'location'],   // Mayadevi Temple → Lumbini

    // ─── Monuments → Locations ───
    ['monument_1',   'location_4',  'located_at',       'location'],   // Swayambhunath Stupa → Swayambhunath
    ['monument_2',   'location_5',  'located_at',       'location'],   // Boudhanath Stupa → Boudhanath
    ['monument_3',   'location_2',  'located_at',       'location'],   // Ashoka Stupa → Patan
    ['monument_4',   'location_9',  'located_at',       'location'],   // Chilancho → Kirtipur
    ['monument_6',   'location_2',  'located_at',       'location'],   // Mahaboudha → Patan

    // ─── Rituals → Locations ───
    ['ritual_1',     'location_1',  'performed_at',     'location'],   // Kumari Puja → Kathmandu Durbar Square
    ['ritual_2',     'location_2',  'performed_at',     'location'],   // Samyak → Patan Durbar Square
    ['ritual_4',     'location_1',  'performed_at',     'location'],   // Navami Puja → Kathmandu Durbar Square
    ['ritual_5',     'location_6',  'performed_at',     'location'],   // Shraddha → Pashupatinath
    ['ritual_6',     'location_4',  'performed_at',     'location'],   // Homa → Swayambhunath

    // ─── Festivals → Locations ───
    ['festival_1',   'location_3',  'celebrated_at',    'location'],   // Bisket Jatra → Bhaktapur
    ['festival_2',   'location_2',  'celebrated_at',    'location'],   // Rato Machindranath → Patan
    ['festival_3',   'location_1',  'celebrated_at',    'location'],   // Seto Machindranath → Kathmandu
    ['festival_5',   'location_1',  'celebrated_at',    'location'],   // Indra Jatra → Kathmandu
    ['festival_6',   'location_1',  'celebrated_at',    'location'],   // Yenya Punhi → Kathmandu
    ['festival_7',   'location_2',  'celebrated_at',    'location'],   // Machindranath Snan → Patan

    // ─── Iconography → Locations ───
    ['iconography_1', 'location_7', 'displayed_at',     'location'],   // Vishwarupa → Changu Narayan
    ['iconography_3', 'location_1', 'displayed_at',     'location'],   // Kal Bhairav → Kathmandu Durbar Square
    ['iconography_5', 'location_1', 'displayed_at',     'location'],   // Golden Taleju → Kathmandu Durbar Square
    ['iconography_8', 'location_7', 'displayed_at',     'location'],   // Garuda Statue → Changu Narayan

    // ─── Guthis → Locations ───
    ['guthi_1',      'location_2',  'based_in',         'location'],   // Rato Machindranath Guthi → Patan
    ['guthi_2',      'location_1',  'based_in',         'location'],   // Taleju Guthi → Kathmandu Durbar Square
    ['guthi_3',      'location_3',  'based_in',         'location'],   // Nani Guthi → Bhaktapur
    ['guthi_4',      'location_6',  'based_in',         'location'],   // Pashupatinath Guthi → Pashupatinath
    ['guthi_6',      'location_11', 'based_in',         'location'],   // Manka Guthi → Thimi

    // ─── Iconography → Deities (depicts) ───
    ['iconography_3', 'deity_3',    'depicts',          'relation'],   // Kal Bhairav image → Bhairav
    ['iconography_5', 'deity_1',    'depicts',          'relation'],   // Golden Taleju → Taleju Bhawani
    ['iconography_2', 'deity_7',    'depicts',          'relation'],   // Paubha Vasudhara → White Tara (related Buddhist)

    // ─── Festivals → Deities (honors) ───
    ['festival_1',   'deity_3',     'honors',           'relation'],   // Bisket Jatra → Bhairav
    ['festival_2',   'deity_2',     'honors',           'relation'],   // Rato Machindranath Jatra → Machhindranath
    ['festival_3',   'deity_2',     'honors',           'relation'],   // Seto Machindranath → Machhindranath
    ['festival_5',   'deity_4',     'honors',           'relation'],   // Indra Jatra → Kumari
    ['festival_7',   'deity_2',     'honors',           'relation'],   // Machindranath Snan → Machhindranath
    ['festival_8',   'deity_2',     'honors',           'relation'],   // Bhoto Jatra → Machhindranath

    // ─── Events → Deities ───
    ['event_1',      'deity_4',     'features',         'relation'],   // Indra Jatra event → Kumari
    ['event_1',      'deity_3',     'features',         'relation'],   // Indra Jatra event → Bhairav
    ['event_2',      'deity_3',     'honors',           'relation'],   // Bisket Jatra event → Bhairav

    // ─── Rituals → Deities ───
    ['ritual_1',     'deity_4',     'worships',         'relation'],   // Kumari Puja → Kumari
    ['ritual_4',     'deity_1',     'worships',         'relation'],   // Navami Puja → Taleju Bhawani
    ['ritual_5',     'deity_8',     'performed_at_temple_of', 'relation'], // Shraddha → Pashupatinath deity

    // ─── Guthis → Deities (manages worship of) ───
    ['guthi_1',      'deity_2',     'manages_worship',  'relation'],   // Rato Machindranath Guthi → Machhindranath
    ['guthi_2',      'deity_1',     'manages_worship',  'relation'],   // Taleju Guthi → Taleju Bhawani
    ['guthi_4',      'deity_8',     'manages_worship',  'relation'],   // Pashupatinath Guthi → Pashupatinath deity

    // ─── Persons → Structures (built/commissioned) ───
    ['person_2',     'structure_4', 'built',            'relation'],   // Bhimsen Thapa → Dharahara
    ['person_3',     'structure_8', 'built',            'relation'],   // Pratap Malla → Rani Pokhari

    // ─── Persons → Locations (associated with) ───
    ['person_1',     'location_2',  'born_in',          'location'],   // Arniko → Patan
    ['person_3',     'location_1',  'ruled',            'location'],   // Pratap Malla → Kathmandu Durbar Square
    ['person_4',     'location_3',  'ruled',            'location'],   // Jaya Sthiti Malla → Bhaktapur
    ['person_5',     'location_1',  'ruled',            'location'],   // Amshuverma → Kathmandu

    // ─── Persons → Persons (related) ───
    ['person_5',     'person_7',    'father_of',        'relation'],   // Amshuverma → Bhrikuti
    ['person_7',     'deity_7',     'identified_as',    'relation'],   // Bhrikuti → White Tara (Green Tara in Tibet)

    // ─── Persons → Periods (active during) ───
    ['person_1',     'period_3',    'active_during',    'relation'],   // Arniko → Thakuri Period
    ['person_5',     'period_2',    'active_during',    'relation'],   // Amshuverma → Lichhavi Period
    ['person_7',     'period_2',    'active_during',    'relation'],   // Bhrikuti → Lichhavi Period
    ['person_3',     'period_5',    'active_during',    'relation'],   // Pratap Malla → Late Malla
    ['person_4',     'period_4',    'active_during',    'relation'],   // Jaya Sthiti Malla → Early Malla
    ['person_10',    'period_2',    'active_during',    'relation'],   // Chunda Vajracharya → Lichhavi
    ['person_2',     'period_6',    'active_during',    'relation'],   // Bhimsen Thapa → Shah Period
    ['person_6',     'period_8',    'active_during',    'relation'],   // Laxmi Prasad Devkota → Modern Period
    ['person_8',     'period_7',    'active_during',    'relation'],   // Siddhidas Mahaju → Rana Period
    ['person_9',     'period_7',    'active_during',    'relation'],   // Yogbir Singh → Rana Period

    // ─── Persons → Traditions (practiced/contributed) ───
    ['person_10',    'tradition_2', 'practiced',        'relation'],   // Chunda Vajracharya → Newari Metalwork
    ['person_6',     'tradition_4', 'contributed_to',   'relation'],   // Devkota → (literary) Deusi Bhailo tradition
    ['person_1',     'tradition_2', 'mastered',         'relation'],   // Arniko → Newari Metalwork

    // ─── Traditions → Deities ───
    ['tradition_1',  'deity_4',     'venerates',        'relation'],   // Kumari Worship → Kumari
    ['tradition_1',  'deity_1',     'associated_with',  'relation'],   // Kumari Worship → Taleju
    ['tradition_6',  'deity_5',     'invokes',          'relation'],   // Charya Nritya → Manjushri (Buddhist)
    ['tradition_8',  'deity_3',     'depicts',          'relation'],   // Lakhe Dance → Bhairav-like demon

    // ─── Traditions → Events/Festivals ───
    ['tradition_5',  'event_1',     'performed_at',     'relation'],   // Dhime Dance → Indra Jatra
    ['tradition_8',  'event_1',     'performed_at',     'relation'],   // Lakhe Dance → Indra Jatra
    ['tradition_4',  'event_4',     'performed_during', 'relation'],   // Deusi Bhailo → Tihar

    // ─── Events → Locations (affected / took place in) ───
    ['event_5',      'location_1',  'affected',         'location'],   // Gorkha Unification → Kathmandu
    ['event_5',      'location_9',  'affected',         'location'],   // Gorkha Unification → Kirtipur
    ['event_5',      'location_10', 'based_at',         'location'],   // Gorkha Unification → Nuwakot
    ['event_6',      'location_3',  'damaged',          'location'],   // 1934 Earthquake → Bhaktapur
    ['event_7',      'location_1',  'damaged',          'location'],   // 2015 Earthquake → Kathmandu Durbar Square
    ['event_7',      'location_12', 'damaged',          'location'],   // 2015 Earthquake → Sankhu
    ['event_7',      'location_3',  'damaged',          'location'],   // 2015 Earthquake → Bhaktapur

    // ─── Events → Structures (damaged/destroyed) ───
    ['event_6',      'structure_4', 'destroyed',        'relation'],   // 1934 earthquake → Dharahara
    ['event_7',      'structure_3', 'destroyed',        'relation'],   // 2015 earthquake → Kasthamandap
    ['event_7',      'structure_4', 'destroyed',        'relation'],   // 2015 earthquake → Dharahara (again)

    // ─── Events → Periods ───
    ['event_5',      'period_6',    'marks_start_of',   'relation'],   // Gorkha Unification → Shah Period
    ['event_6',      'period_7',    'occurred_during',  'relation'],   // 1934 earthquake → Rana Period
    ['event_7',      'period_8',    'occurred_during',  'relation'],   // 2015 earthquake → Modern Period

    // ─── Guthis → Festivals ───
    ['guthi_1',      'festival_2',  'organizes',        'relation'],   // Rato Machindranath Guthi → Rato Machindranath Festival
    ['guthi_3',      'festival_1',  'supports',         'relation'],   // Nani Guthi → Bisket Jatra Festival

    // ─── Sources → Topics (documents) ───
    ['source_1',     'location_1',  'documents',        'relation'],   // Nepal Mandala → Kathmandu
    ['source_2',     'tradition_2', 'documents',        'relation'],   // Art of Nepal → Newari Metalwork
    ['source_3',     'location_1',  'documents',        'relation'],   // UNESCO Preservation → Kathmandu
    ['source_4',     'period_2',    'documents',        'relation'],   // Lichhavi Inscriptions → Lichhavi Period
    ['source_5',     'period_4',    'documents',        'relation'],   // Medieval Nepal → Early Malla
    ['source_6',     'event_1',     'documents',        'relation'],   // Festivals of Nepal → Indra Jatra
    ['source_7',     'event_7',     'documents',        'relation'],   // Heritage Recovery → 2015 Earthquake
    ['source_8',     'tradition_1', 'documents',        'relation'],   // Living with Gods → Kumari Worship
    ['source_9',     'structure_1', 'documents',        'relation'],   // Traditional Architecture → Nyatapola
    ['source_10',    'period_6',    'documents',        'relation'],   // Growth of a Nation → Shah Period
    ['source_11',    'person_1',    'documents',        'relation'],   // Newar Merchants → Arniko (trade)
    ['source_12',    'period_2',    'documents',        'relation'],   // Stone Inscriptions → Lichhavi Period

    // ─── Deities → Locations (worshipped at) ───
    ['deity_1',      'location_1',  'worshipped_at',    'location'],   // Taleju → Kathmandu Durbar Square
    ['deity_1',      'location_2',  'worshipped_at',    'location'],   // Taleju → Patan Durbar Square
    ['deity_1',      'location_3',  'worshipped_at',    'location'],   // Taleju → Bhaktapur Durbar Square
    ['deity_8',      'location_6',  'enshrined_at',     'location'],   // Pashupatinath → Pashupatinath Temple
    ['deity_6',      'location_1',  'shrine_at',        'location'],   // Ganesh → Kathmandu (Ashok Binayak)
    ['deity_5',      'location_4',  'associated_with',  'location'],   // Manjushri → Swayambhunath

    // ─── Historical Periods → Locations (flourished at) ───
    ['period_2',     'location_7',  'flourished_at',    'location'],   // Lichhavi → Changu Narayan
    ['period_5',     'location_1',  'flourished_at',    'location'],   // Late Malla → Kathmandu Durbar Square
    ['period_5',     'location_2',  'flourished_at',    'location'],   // Late Malla → Patan Durbar Square
    ['period_5',     'location_3',  'flourished_at',    'location'],   // Late Malla → Bhaktapur Durbar Square

    // ─── Cross-category semantic links ───
    ['deity_4',      'deity_1',     'incarnation_of',   'relation'],   // Kumari → Taleju (incarnation)
    ['deity_3',      'deity_8',     'form_of',          'relation'],   // Bhairav → Pashupatinath (Shiva)
    ['monument_1',   'deity_5',     'associated_with',  'relation'],   // Swayambhunath Stupa → Manjushri legend
  ];

  // Build edges array from semantic tuples
  const edges: InstanceEdge[] = semanticEdges
    .filter(([src, tgt]) => nodeIdSet.has(src) && nodeIdSet.has(tgt))
    .map(([source, target, label, edgeType], i) => ({
      id: `demo_edge_${i}`,
      source,
      target,
      label,
      edgeType,
    }));

  return { nodes, edges, isDemo: true };
}

/* ══════════════════════════════════════════════════════
 *  Fetch all entity data from backend
 * ══════════════════════════════════════════════════════ */

export async function fetchInstanceGraphData(
  apiBaseUrl: string,
  token?: string,
): Promise<InstanceGraphData> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Try fetching from backend; fall back to demo data if unreachable
  let results: PromiseSettledResult<{ config: EntityConfig; data: Record<string, any>[] }>[];
  try {
    results = await Promise.allSettled(
      ENTITY_CONFIGS.map(async (config) => {
        const res = await fetch(`${apiBaseUrl}${config.endpoint}`, { headers });
        if (!res.ok) return { config, data: [] };
        const json = await res.json();
        const data = Array.isArray(json) ? json : json.results ?? [];
        return { config, data };
      }),
    );
  } catch {
    // Backend unreachable — return demo data
    return buildDemoGraphData();
  }

  const nodes: InstanceNode[] = [];
  const edges: InstanceEdge[] = [];
  const nodeIdSet = new Set<string>();

  // Build a name → nodeId index for cross-entity linking
  const nameIndex = new Map<string, string>();

  // First pass: create all nodes
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { config, data } = result.value;

    for (const item of data) {
      const id = `${config.category}_${item.id}`;
      const name = item[config.nameField] || `Unnamed ${config.entityType}`;
      const desc = item[config.descriptionField] || '';

      if (nodeIdSet.has(id)) continue;
      nodeIdSet.add(id);

      nodes.push({
        id,
        label: name,
        category: config.category,
        entityType: config.entityType,
        description: typeof desc === 'string' ? desc.slice(0, 300) : '',
        apiEndpoint: config.endpoint,
        rawData: item,
      });

      // Index the name for cross-entity linking (lowercase for matching)
      const normalizedName = String(name).toLowerCase().trim();
      if (normalizedName) {
        nameIndex.set(normalizedName, id);
      }
    }
  }

  // Second pass: create edges
  let edgeCounter = 0;
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { config, data } = result.value;

    for (const item of data) {
      const sourceId = `${config.category}_${item.id}`;

      // Location-based edges
      if (config.locationField) {
        const locationName = item[config.locationField];
        if (locationName && typeof locationName === 'string' && locationName.trim()) {
          const normalizedLoc = locationName.toLowerCase().trim();
          const targetId = nameIndex.get(normalizedLoc);
          if (targetId && targetId !== sourceId) {
            edges.push({
              id: `edge_loc_${edgeCounter++}`,
              source: sourceId,
              target: targetId,
              label: 'located_at',
              edgeType: 'location',
            });
          }
        }
      }

      // Relation-based edges (name matching across entities)
      for (const rel of config.relationFields) {
        const fieldValue = item[rel.field];
        if (!fieldValue || typeof fieldValue !== 'string' || !fieldValue.trim()) continue;

        // If targeting a specific category, search only in that category
        const normalizedValue = fieldValue.toLowerCase().trim();
        const targetId = nameIndex.get(normalizedValue);
        if (targetId && targetId !== sourceId) {
          edges.push({
            id: `edge_rel_${edgeCounter++}`,
            source: sourceId,
            target: targetId,
            label: rel.label,
            edgeType: 'relation',
          });
        }
      }

      // Cross-reference: structures managed by guthis
      if (config.category === 'guthi' && item.managed_structures) {
        const structures = String(item.managed_structures).split(',');
        for (const s of structures) {
          const normalizedS = s.toLowerCase().trim();
          const targetId = nameIndex.get(normalizedS);
          if (targetId && targetId !== sourceId) {
            edges.push({
              id: `edge_manages_${edgeCounter++}`,
              source: sourceId,
              target: targetId,
              label: 'manages',
              edgeType: 'relation',
            });
          }
        }
      }

      // Cross-reference: iconographic objects depicting deities
      if (config.category === 'iconography' && item.depicts_deity) {
        const deityName = String(item.depicts_deity).toLowerCase().trim();
        const targetId = nameIndex.get(deityName);
        if (targetId && targetId !== sourceId) {
          edges.push({
            id: `edge_depicts_${edgeCounter++}`,
            source: sourceId,
            target: targetId,
            label: 'depicts',
            edgeType: 'relation',
          });
        }
      }
    }
  }

  // Third pass: detect co-location edges (entities sharing the same location name)
  const locationGroups = new Map<string, string[]>();
  for (const result of results) {
    if (result.status !== 'fulfilled' || !result.value) continue;
    const { config, data } = result.value;
    if (!config.locationField) continue;

    for (const item of data) {
      const loc = item[config.locationField];
      if (!loc || typeof loc !== 'string' || !loc.trim()) continue;
      const normalizedLoc = loc.toLowerCase().trim();
      const nodeId = `${config.category}_${item.id}`;
      if (!locationGroups.has(normalizedLoc)) {
        locationGroups.set(normalizedLoc, []);
      }
      locationGroups.get(normalizedLoc)!.push(nodeId);
    }
  }

  // Create co-location edges between entities at the same location
  for (const [, group] of locationGroups) {
    if (group.length < 2 || group.length > 8) continue; // Skip huge clusters
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (group[i] !== group[j]) {
          edges.push({
            id: `edge_coloc_${edgeCounter++}`,
            source: group[i],
            target: group[j],
            label: 'co-located',
            edgeType: 'location',
          });
        }
      }
    }
  }

  // Fallback: if backend returned zero data, use demo dataset
  if (nodes.length === 0) {
    return buildDemoGraphData();
  }

  return { nodes, edges, isDemo: false };
}

/* ══════════════════════════════════════════════════════
 *  Helper: get instance stats
 * ══════════════════════════════════════════════════════ */

export function getInstanceStats(data: InstanceGraphData) {
  const byCategory = new Map<InstanceCategory, number>();
  for (const node of data.nodes) {
    byCategory.set(node.category, (byCategory.get(node.category) || 0) + 1);
  }
  return {
    totalEntities: data.nodes.length,
    totalRelationships: data.edges.length,
    relationEdges: data.edges.filter((e) => e.edgeType === 'relation').length,
    locationEdges: data.edges.filter((e) => e.edgeType === 'location').length,
    categories: byCategory.size,
    byCategory: Object.fromEntries(byCategory),
  };
}
