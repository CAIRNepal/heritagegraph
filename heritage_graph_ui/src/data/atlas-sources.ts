import type { DataSource } from '@/types/atlas';

/**
 * Synthetic sources for the Atlas sample corpus.
 *
 * One entry per reliability tier and source type, so the demo can show how a
 * provenance chain grades its evidence. Every citation here is fictional and
 * says so.
 *
 * This file previously carried fabricated bibliographic citations attributed to
 * real bodies — UNESCO nomination dossiers, the Nepal National Archives
 * ("Register Series T-140"), the Nepal Gazette, the Patan Museum accession
 * registers, and an invented monograph with a named author and publisher.
 * Fabricated citations that resolve to real institutions are the kind of thing
 * that gets papers retracted, and they are indistinguishable from real ones in
 * a screenshot. Real citations belong in the live graph, attached to real
 * `DataSource` rows; this file must stay fictional.
 *
 * IDs are neutral too: `agent-gopal-vajracharya` shipped the surname into
 * every JS bundle and every graph export, even after the display name was
 * fixed. Keep identifiers role-based.
 */
export const ATLAS_SOURCES: DataSource[] = [
  {
    id: 'src-listing-dossier',
    name: 'Sample international listing dossier (fictional)',
    sourceType: 'PublishedBook',
    reliabilityTier: 'A',
    citation: 'SAMPLE DATA — fictional listing documentation, not a real dossier.',
    archivalLocation: 'https://example.org/sample-listing',
  },
  {
    id: 'src-monograph',
    name: 'Sample peer-reviewed monograph (fictional)',
    sourceType: 'PublishedBook',
    reliabilityTier: 'A',
    citation: 'SAMPLE DATA — fictional monograph, not a real publication.',
  },
  {
    id: 'src-journal-article',
    name: 'Sample journal article (fictional)',
    sourceType: 'PublishedBook',
    reliabilityTier: 'A',
    citation: 'SAMPLE DATA — fictional journal article, not a real publication.',
  },
  {
    id: 'src-archive-register',
    name: 'Sample national archive register (fictional)',
    sourceType: 'Archive',
    reliabilityTier: 'B',
    citation: 'SAMPLE DATA — fictional archival register, not a real holding.',
    archivalLocation: 'https://example.org/sample-archive',
  },
  {
    id: 'src-field-survey-2023',
    name: 'Sample structured field survey (fictional)',
    sourceType: 'FieldSurvey',
    reliabilityTier: 'B',
    citation: 'SAMPLE DATA — fictional field survey dataset.',
  },
  {
    id: 'src-museum-catalogue',
    name: 'Sample museum catalogue (fictional)',
    sourceType: 'MuseumCollection',
    reliabilityTier: 'B',
    citation: 'SAMPLE DATA — fictional accession catalogue, not a real register.',
  },
  {
    id: 'src-gazette-listing',
    name: 'Sample government gazette listing (fictional)',
    sourceType: 'Archive',
    reliabilityTier: 'B',
    citation: 'SAMPLE DATA — fictional gazette schedule, not a real instrument.',
  },
  {
    id: 'src-community-notebook',
    name: 'Sample local heritage notebook (fictional)',
    sourceType: 'OralHistoryInterview',
    reliabilityTier: 'C',
    citation: 'SAMPLE DATA — fictional community notebook.',
  },
  {
    id: 'src-community-jatra-notes',
    name: 'Sample oral chronicle (fictional)',
    sourceType: 'OralHistoryInterview',
    reliabilityTier: 'C',
    citation: 'SAMPLE DATA — fictional aggregated interview notes.',
  },
  {
    id: 'src-inscription-transcription',
    name: 'Sample inscription transcription (fictional)',
    sourceType: 'Manuscript',
    reliabilityTier: 'B',
    citation: 'SAMPLE DATA — fictional transcription, not a real epigraphic record.',
  },
  {
    id: 'src-open-encyclopedia',
    name: 'Sample open-encyclopedia snapshot (fictional)',
    sourceType: 'PublishedBook',
    reliabilityTier: 'D',
    citation: 'SAMPLE DATA — fictional low-reliability web source.',
    archivalLocation: 'https://example.org/sample-encyclopedia',
  },
  {
    id: 'src-social-thread',
    name: 'Sample forum thread export (fictional)',
    sourceType: 'PublishedBook',
    reliabilityTier: 'D',
    citation: 'SAMPLE DATA — fictional discussion thread.',
  },
];
