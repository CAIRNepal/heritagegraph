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

  ReligiousTraditionEnum: [
    { value: "Hindu", label: "Hindu", description: "Hindu tradition" },
    { value: "Buddhist", label: "Buddhist", description: "Buddhist tradition" },
    { value: "Syncretic", label: "Syncretic", description: "Syncretic (blended traditions)" },
    { value: "Jain", label: "Jain", description: "Jain tradition" },
    { value: "Animist", label: "Animist", description: "Indigenous animist tradition" },
    { value: "Other", label: "Other", description: "Other tradition" },
  ],

  CustodianTypeEnum: [
    { value: "government", label: "Government", description: "Government institution (e.g., DoA Nepal)" },
    { value: "academic", label: "Academic", description: "University or research institution" },
    { value: "community", label: "Community", description: "Community organization or Guthi" },
    { value: "museum", label: "Museum", description: "Museum or gallery" },
    { value: "private", label: "Private", description: "Private collector or foundation" },
    { value: "religious", label: "Religious", description: "Religious institution (Vihar, Math)" },
  ],

  DataCiteResourceTypeEnum: [
    { value: "Dataset", label: "Dataset" },
    { value: "Text", label: "Text" },
    { value: "Image", label: "Image" },
    { value: "Audio", label: "Audio" },
    { value: "Interview", label: "Interview" },
    { value: "PhysicalObject", label: "Physical Object" },
    { value: "Collection", label: "Collection" },
  ],

  IdentifierTypeEnum: [
    { value: "DOI", label: "DOI" },
    { value: "ISBN", label: "ISBN" },
    { value: "Handle", label: "Handle" },
    { value: "URL", label: "URL" },
    { value: "LocalArchiveID", label: "Local Archive ID" },
    { value: "ISSN", label: "ISSN" },
  ],

  VerificationMethodEnum: [
    { value: "cross_check", label: "Cross-check", description: "Verified against multiple sources" },
    { value: "expert_review", label: "Expert Review", description: "Verified by domain expert" },
    { value: "field_visit", label: "Field Visit", description: "Verified by on-site field visit" },
    { value: "archival_comparison", label: "Archival Comparison", description: "Compared with archival records" },
    { value: "oral_testimony", label: "Oral Testimony", description: "Confirmed by community knowledge holders" },
  ],

  DocumentationMethodEnum: [
    { value: "photographic_survey", label: "Photographic Survey" },
    { value: "measured_drawing", label: "Measured Drawing" },
    { value: "gps_mapping", label: "GPS Mapping" },
    { value: "oral_history_interview", label: "Oral History Interview" },
    { value: "archival_research", label: "Archival Research" },
    { value: "literature_review", label: "Literature Review" },
    { value: "3d_scanning", label: "3D Scanning" },
    { value: "drone_survey", label: "Drone Survey" },
  ],

  FestivalTypeEnum: [
    { value: "ChariotFestival", label: "Chariot Festival (Rath Jatra)", description: "Festival involving ceremonial chariot procession" },
    { value: "MaskedDance", label: "Masked Dance Festival", description: "Festival featuring masked dancers embodying deities" },
    { value: "Jatra", label: "General Jatra", description: "Community procession festival" },
    { value: "Other", label: "Other", description: "Other festival type" },
  ],

  StructureTypeEnum: [
    { value: "Temple", label: "Temple", description: "Sacred architectural structure with deity enshrinement" },
    { value: "Stupa", label: "Stupa", description: "Buddhist dome-shaped reliquary shrine" },
    { value: "Chaitya", label: "Chaitya", description: "Buddhist votive shrine or prayer hall" },
    { value: "Pati", label: "Pati (Open Pavilion)", description: "Open-air pavilion for resting travelers" },
    { value: "Sattal", label: "Sattal (Multi-story Rest House)", description: "Multi-story rest house with ritual and social functions" },
    { value: "Dharmashala", label: "Dharmashala (Pilgrim Lodge)", description: "Pilgrim lodge operated by a Guthi organization" },
    { value: "DhungeDhara", label: "Dhunge Dhara (Stone Spout)", description: "Stone spout with carved imagery for ritual bathing and water supply" },
    { value: "Pokhari", label: "Pokhari (Pond/Tank)", description: "Pond or tank for water storage and ritual bathing" },
    { value: "Other", label: "Other", description: "Other structure type" },
  ],

  IconographicObjectTypeEnum: [
    { value: "Paubha", label: "Paubha (Scroll Painting)", description: "Traditional Newari scroll painting with mandala and deity iconography" },
    { value: "Murti", label: "Murti (Consecrated Statue)", description: "Consecrated statue serving as divine presence" },
    { value: "Other", label: "Other Iconographic Object", description: "Other sacred visual art object" },
  ],

  MonumentTypeEnum: [
    { value: "Stupa", label: "Stupa", description: "Buddhist dome-shaped reliquary" },
    { value: "Chaitya", label: "Chaitya", description: "Buddhist votive shrine" },
    { value: "Other", label: "Other Buddhist Monument", description: "Other Buddhist sacred structure" },
  ],
} as const;

export type EnumKey = keyof typeof ontologyEnums;
