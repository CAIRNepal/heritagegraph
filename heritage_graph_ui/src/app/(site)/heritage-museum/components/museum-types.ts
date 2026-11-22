export type MuseumDataSource = 'demo' | 'live';

export interface MuseumCorpusProvenance {
  textAuthorship?: 'unrecorded' | 'sourced';
  textAuthorshipNote?: string;
  generatedBy?: string;
  retrieved?: string;
  imageSource?: string;
  note?: string;
  extension?: { records?: number } | null;
}
