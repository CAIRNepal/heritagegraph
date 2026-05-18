// AUTO-GENERATED — do not edit by hand.
// Source:  ontology/HeritageGraph.yaml (enums section)
// Regen:   python3 tools/gen_heritage_viz_config.py
// Hash:    53d091af28219e1a
//
// Controlled vocabularies for select fields in contribution forms.
// Edit permissible_values in the schema, then re-run the generator.


export const ontologyEnums = {
  ConditionTypeEnum: [
    { value: "Good", label: "Good", description: "No significant damage" },
    { value: "Damaged", label: "Damaged", description: "Partially damaged" },
    { value: "Ruined", label: "Ruined", description: "Severely damaged or collapsed" },
    { value: "Restored", label: "Restored", description: "Repaired and stabilized" },
  ],

  ExistenceStatusEnum: [
    { value: "Extant", label: "Extant", description: "Currently exists in physical form" },
    { value: "PartiallyExtant", label: "PartiallyExtant", description: "Fragments or ruins remain" },
    { value: "Destroyed", label: "Destroyed", description: "Known to have been destroyed; no physical remains" },
    { value: "Lost", label: "Lost", description: "Existence documented but location/remains unknown" },
    { value: "Hypothetical", label: "Hypothetical", description: "Reconstructed or theorized; never physically realized" },
    { value: "Unknown", label: "Unknown", description: "Existence status uncertain" },
  ],

  RitualTypeEnum: [
    { value: "NityaPuja", label: "NityaPuja", description: "Daily mandatory worship" },
    { value: "NaimittikaPuja", label: "NaimittikaPuja", description: "Occasional/Festival worship" },
    { value: "KamyaPuja", label: "KamyaPuja", description: "Desire-based optional worship" },
    { value: "Abhisheka", label: "Abhisheka", description: "Ritual bathing/anointing of deity" },
    { value: "Homa", label: "Homa", description: "Fire offering ritual" },
    { value: "Bhajan", label: "Bhajan", description: "Devotional singing ritual" },
    { value: "Yagna", label: "Yagna", description: "Vedic sacrifice ritual" },
    { value: "Vrata", label: "Vrata", description: "Vow observance ritual" },
    { value: "Jatra", label: "Jatra", description: "Festival procession ritual" },
    { value: "ChariotProcession", label: "ChariotProcession", description: "Ritual chariot pulling" },
    { value: "MaskedPerformance", label: "MaskedPerformance", description: "Ritual masked dance" },
    { value: "RitualConsecration", label: "RitualConsecration", description: "Consecration/activation ritual" },
    { value: "ProcessionRitual", label: "ProcessionRitual", description: "Ritual procession/movement" },
    { value: "InstallationRitual", label: "InstallationRitual", description: "Installation/enshrinement ritual" },
    { value: "DeinstallationRitual", label: "DeinstallationRitual", description: "De-installation/conclusion ritual" },
    { value: "ReturningRitual", label: "ReturningRitual", description: "Return to normal state ritual" },
    { value: "Circumambulation", label: "Circumambulation", description: "Ritual circular movement around sacred site" },
    { value: "RelicTour", label: "RelicTour", description: "Procession with sacred relics between sites" },
    { value: "ProcessionalMovement", label: "ProcessionalMovement", description: "General ritual movement between locations" },
  ],

  DatePrecisionEnum: [
    { value: "Exact", label: "Exact", description: "Precise date known" },
    { value: "Year", label: "Year", description: "Year-level precision only" },
    { value: "Decade", label: "Decade", description: "Within 10-year range" },
    { value: "Century", label: "Century", description: "Within century range" },
    { value: "Circa", label: "Circa", description: "Approximate date" },
  ],

  SyncreticTypeEnum: [
    { value: "Equivalence", label: "Equivalence", description: "Same deity in different traditions (e.g., Avalokiteshvara = Matsyendranath)" },
    { value: "Appropriation", label: "Appropriation", description: "Deity borrowed from one tradition into another" },
    { value: "Fusion", label: "Fusion", description: "Intrinsically syncretic deity merging multiple traditions" },
    { value: "Historical", label: "Historical", description: "Gradual syncretism over time" },
  ],

  ArchitecturalStyleEnum: [
    { value: "Pagoda", label: "Pagoda", description: "Multi-tiered roof style indigenous to Nepal" },
    { value: "Shikhara", label: "Shikhara", description: "North Indian spire-shaped style" },
    { value: "Dome", label: "Dome", description: "Dome-based style (Mughal/Neo-classical influence)" },
    { value: "Chaitya", label: "Chaitya", description: "Buddhist votive shrine style" },
    { value: "Stupa", label: "Stupa", description: "Buddhist dome-shaped reliquary" },
  ],

  GuthiTypeEnum: [
    { value: "SiGuthi", label: "SiGuthi", description: "Funeral trust" },
    { value: "JatraGuthi", label: "JatraGuthi", description: "Festival organization trust" },
    { value: "PujaGuthi", label: "PujaGuthi", description: "Daily worship trust" },
    { value: "TempleGuthi", label: "TempleGuthi", description: "Temple maintenance trust" },
    { value: "NashaGuthi", label: "NashaGuthi", description: "Music and dance trust" },
    { value: "SanaGuthi", label: "SanaGuthi", description: "Agricultural cooperative trust" },
    { value: "SanGuthi", label: "SanGuthi", description: "Life-cycle ritual trust" },
    { value: "RajGuthi", label: "RajGuthi", description: "Royal endowment trust" },
  ],

} as const;

export type EnumKey = keyof typeof ontologyEnums;
