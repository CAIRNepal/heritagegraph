'use client';

import type { EntityType, Surface } from '@/providers/ChatContextProvider';

const CHIPS: Record<string, string[]> = {
  Monument: ['Who built this?', 'Related festivals', 'Historical period'],
  Festival: ['Which deity?', 'Related monuments', 'Guthi organisers'],
  Person: ['Linked festivals', 'Related Guthis', 'Historical period'],
  Deity: ['Associated monuments', 'Related rituals', 'Iconography'],
  Guthi: ['Related festivals', 'Historical period', 'Members'],
  default: [
    'What is HeritageGraph?',
    'Show me monuments',
    'How do I contribute?',
  ],
  dashboard: ['How do I fork?', 'Go to contribute', 'Check my queue'],
};

interface SuggestionChipsProps {
  entityType?: EntityType;
  surface: Surface;
  onSelect: (text: string) => void;
}

export function SuggestionChips({
  entityType,
  surface,
  onSelect,
}: SuggestionChipsProps) {
  let chips: string[];
  if (surface === 'dashboard') {
    chips = CHIPS.dashboard;
  } else if (entityType && CHIPS[entityType]) {
    chips = CHIPS[entityType];
  } else {
    chips = CHIPS.default;
  }

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onSelect(chip)}
          className="text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-secondary hover:text-secondary-foreground transition-colors"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}
