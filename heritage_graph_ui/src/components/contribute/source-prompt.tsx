'use client';

import { useTranslations } from 'next-intl';
import { IconBook2 } from '@tabler/icons-react';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { surfaceCard } from '@/lib/design';
import { cn } from '@/lib/utils';

interface SourcePromptProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

/**
 * "What's your source for this?" — asked on every contribution form.
 *
 * Descriptive records had nowhere to record evidence: provenance lived only on
 * `HeritageAssertion`, and only optionally, so a record could be created,
 * accepted and published with no evidence trail. Persists to
 * `MetaData.source_citation`.
 *
 * Deliberately optional. Requiring it would reject existing rows and block
 * contributors who hold genuine oral or personal knowledge — which is exactly
 * the knowledge this platform exists to capture. The purpose is to make the
 * question unavoidable and the answer measurable
 * (`kg_quality_report` → `entity_source_coverage`), not to gate submission.
 *
 * It sits next to Submit rather than inside a section tab because it applies to
 * the whole record, and because a contributor who never opens the last tab
 * would otherwise never be asked.
 */
export function SourcePrompt({ value, onChange, disabled }: SourcePromptProps) {
  const t = useTranslations('contribute.sourcePrompt');
  const answered = value.trim().length > 0;

  return (
    <div
      className={cn(
        surfaceCard,
        'p-4',
        answered ? 'border-primary/30' : 'border-amber-500/40 bg-amber-500/5',
      )}
    >
      <Label
        htmlFor="source-citation"
        className="flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <IconBook2 className="size-4 text-primary" aria-hidden />
        {t('label')}
      </Label>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t('help')}
      </p>
      <Textarea
        id="source-citation"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('placeholder')}
        rows={2}
        className="mt-3 resize-y"
        aria-describedby="source-citation-note"
      />
      <p id="source-citation-note" className="mt-2 text-xs text-muted-foreground">
        {answered ? t('answered') : t('optional')}
      </p>
    </div>
  );
}
