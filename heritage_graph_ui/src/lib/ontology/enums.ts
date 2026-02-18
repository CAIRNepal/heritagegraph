// =================================================================
// Ontology Enums — Derived from HeritageGraph.yaml
// =================================================================
// Controlled vocabularies from the ontology, used by select fields.
// =================================================================

export const ontologyEnums = {
  ConditionTypeEnum: [
    { value: "Good", label: "Good", description: "No significant damage" },
    { value: "Damaged", label: "Damaged", description: "Partially damaged" },
    { value: "Ruined", label: "Ruined", description: "Severely damaged or collapsed" },
    { value: "Restored", label: "Restored", description: "Repaired and stabilized" },
  ],

  ExistenceStatusEnum: [
    { value: "Extant", label: "Extant", description: "Currently exists in physical form" },
    { value: "PartiallyExtant", label: "Partially Extant", description: "Fragments or ruins remain" },
    { value: "Destroyed", label: "Destroyed", description: "Known to have been destroyed" },
    { value: "Lost", label: "Lost", description: "Existence documented but location unknown" },
    { value: "Hypothetical", label: "Hypothetical", description: "Reconstructed or theorized" },
    { value: "Unknown", label: "Unknown", description: "Existence status uncertain" },
  ],

  RitualTypeEnum: [
    { value: "NityaPuja", label: "Nitya Puja", description: "Daily mandatory worship" },
    { value: "NaimittikaPuja", label: "Naimittika Puja", description: "Occasional/Festival worship" },
    { value: "KamyaPuja", label: "Kamya Puja", description: "Desire-based optional worship" },
    { value: "Abhisheka", label: "Abhisheka", description: "Ritual bathing/anointing of deity" },
    { value: "Homa", label: "Homa", description: "Fire offering ritual" },
    { value: "Bhajan", label: "Bhajan", description: "Devotional singing ritual" },
    { value: "Yagna", label: "Yagna", description: "Vedic sacrifice ritual" },
    { value: "Vrata", label: "Vrata", description: "Vow observance ritual" },
    { value: "Jatra", label: "Jatra", description: "Festival procession ritual" },
    { value: "ChariotProcession", label: "Chariot Procession", description: "Ritual chariot pulling" },
    { value: "MaskedPerformance", label: "Masked Performance", description: "Ritual masked dance" },
    { value: "RitualConsecration", label: "Ritual Consecration", description: "Consecration/activation ritual" },
    { value: "ProcessionRitual", label: "Procession Ritual", description: "Ritual procession/movement" },
    { value: "InstallationRitual", label: "Installation Ritual", description: "Installation/enshrinement ritual" },
    { value: "DeinstallationRitual", label: "Deinstallation Ritual", description: "De-installation/conclusion ritual" },
    { value: "ReturningRitual", label: "Returning Ritual", description: "Return to normal state ritual" },
    { value: "Circumambulation", label: "Circumambulation", description: "Ritual circular movement" },
    { value: "RelicTour", label: "Relic Tour", description: "Procession with sacred relics" },
    { value: "ProcessionalMovement", label: "Processional Movement", description: "General ritual movement between locations" },
  ],

  DatePrecisionEnum: [
    { value: "Exact", label: "Exact", description: "Precise date known" },
    { value: "Year", label: "Year", description: "Year-level precision only" },
    { value: "Decade", label: "Decade", description: "Within 10-year range" },
    { value: "Century", label: "Century", description: "Within century range" },
    { value: "Circa", label: "Circa", description: "Approximate date" },
  ],

  ArchitecturalStyleEnum: [
    { value: "Pagoda", label: "Pagoda", description: "Multi-tiered roof style indigenous to Nepal" },
    { value: "Shikhara", label: "Shikhara", description: "North Indian spire-shaped style" },
    { value: "Dome", label: "Dome", description: "Dome-based style (Mughal/Neo-classical influence)" },
    { value: "Chaitya", label: "Chaitya", description: "Buddhist votive shrine style" },
    { value: "Stupa", label: "Stupa", description: "Buddhist dome-shaped reliquary" },
  ],

  GuthiTypeEnum: [
    { value: "SiGuthi", label: "Si Guthi", description: "Funeral trust" },
    { value: "JatraGuthi", label: "Jatra Guthi", description: "Festival organization trust" },
    { value: "PujaGuthi", label: "Puja Guthi", description: "Daily worship trust" },
    { value: "TempleGuthi", label: "Temple Guthi", description: "Temple maintenance trust" },
    { value: "NashaGuthi", label: "Nasha Guthi", description: "Music and dance trust" },
    { value: "SanaGuthi", label: "Sana Guthi", description: "Agricultural cooperative trust" },
    { value: "SanGuthi", label: "San Guthi", description: "Life-cycle ritual trust" },
    { value: "RajGuthi", label: "Raj Guthi", description: "Royal endowment trust" },
  ],

  SyncreticTypeEnum: [
    { value: "Equivalence", label: "Equivalence", description: "Same deity in different traditions" },
    { value: "Appropriation", label: "Appropriation", description: "Deity borrowed from one tradition into another" },
    { value: "Fusion", label: "Fusion", description: "Intrinsically syncretic deity merging multiple traditions" },
    { value: "Historical", label: "Historical", description: "Gradual syncretism over time" },
  ],

  LocationTypeEnum: [
    { value: "city", label: "City" },
    { value: "village", label: "Village" },
    { value: "region", label: "Region" },
    { value: "temple", label: "Temple" },
    { value: "monument", label: "Monument" },
    { value: "museum", label: "Museum" },
    { value: "archaeological_site", label: "Archaeological Site" },
  ],

  SourceTypeEnum: [
    { value: "book", label: "Book" },
    { value: "journal", label: "Journal Article" },
    { value: "archive", label: "Archival Record" },
    { value: "thesis", label: "Thesis" },
    { value: "web", label: "Web Resource" },
    { value: "field_note", label: "Field Note" },
    { value: "oral_history", label: "Oral History" },
    { value: "inscription", label: "Inscription" },
  ],

  TraditionCategoryEnum: [
    { value: "ritual", label: "Ritual" },
    { value: "dance", label: "Dance" },
    { value: "storytelling", label: "Storytelling" },
    { value: "craft", label: "Craft" },
    { value: "music", label: "Music" },
    { value: "festival", label: "Festival" },
  ],

  EventTypeEnum: [
    { value: "festival", label: "Festival" },
    { value: "ritual", label: "Ritual" },
    { value: "historical", label: "Historical" },
    { value: "ceremony", label: "Ceremony" },
  ],

  RecurrenceEnum: [
    { value: "annual", label: "Annual" },
    { value: "biennial", label: "Biennial" },
    { value: "monthly", label: "Monthly" },
    { value: "one_time", label: "One-time" },
  ],
} as const;

export type EnumKey = keyof typeof ontologyEnums;
