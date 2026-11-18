'use client';

import { useTranslations } from 'next-intl';
import { IconBook2 } from '@tabler/icons-react';

import { EntitySearch } from '@/components/contribute/entity-search';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { surfaceCard } from '@/lib/design';
import { cn } from '@/lib/utils';

/** The kinds a DataSource can be (`SOURCE_CATEGORY_CHOICES` on the backend). */
export const SOURCE_KINDS = ['published', 'archival', 'inscription', 'web', 'field_survey', 'oral_history', 'image', 'pdf'] as const;
export const CONFIDENCE_LEVELS = ['certain', 'likely', 'uncertain', 'speculative'] as const;

export interface SourceAnswer {
  citation: string;
  kind: string;
  source: { id: string | number; name: string } | null;
  confidence: string;
}

export const EMPTY_SOURCE_ANSWER: SourceAnswer = { citation: '', kind: '', source: null, confidence: '' };

/** A record is publishable only with a registered source, or a citation and its kind. */
export function sourceAnswerComplete(a: SourceAnswer): boolean {
  if (!a.confidence) return false;
  return Boolean(a.source) || (a.citation.trim().length > 0 && Boolean(a.kind));
}

/** The payload keys the contribution API reads for the answer. */
export function sourceAnswerPayload(a: SourceAnswer): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (a.citation.trim()) out.source_citation = a.citation.trim();
  if (a.source) out.source = a.source.id;
  if (a.kind && !a.source) out.source_kind = a.kind;
  if (a.confidence) out.confidence = a.confidence;
  return out;
}

interface SourcePromptProps {
  value: SourceAnswer;
  onChange: (next: SourceAnswer) => void;
  disabled?: boolean;
}

/**
 * "What's your source for this?" — asked on every contribution form.
 *
 * Required: a reviewer cannot publish a record that names no source. Oral and
 * personal knowledge count; the contributor says so and picks "oral history".
 * The citation becomes a registered DataSource on acceptance, and every link
 * the form proposes cites it with the confidence stated here.
 *
 * It sits next to Submit rather than inside a section tab because it applies to
 * the whole record, and because a contributor who never opens the last tab
 * would otherwise never be asked.
 */
export function SourcePrompt({ value, onChange, disabled }: SourcePromptProps) {
  const t = useTranslations('contribute.sourcePrompt');
  const complete = sourceAnswerComplete(value);
  const set = (patch: Partial<SourceAnswer>) => onChange({ ...value, ...patch });

  return (
    <div className={cn(surfaceCard, 'grid gap-3 p-4', complete ? 'border-primary/30' : 'border-amber-500/40 bg-amber-500/5')}>
      <div>
        <Label htmlFor="source-citation" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconBook2 className="size-4 text-primary" aria-hidden />
          {t('label')}
        </Label>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t('help')}</p>
      </div>

      <div className="grid gap-1.5">
        <Label className="text-xs font-medium">{t('registered')}</Label>
        <EntitySearch
          label=""
          endpoint="/cidoc/data_sources/"
          value={value.source}
          onSelect={(s) => set({ source: s ? { id: s.id, name: s.name } : null })}
          placeholder={t('registeredPlaceholder')}
          disabled={disabled}
        />
      </div>

      {!value.source ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="grid gap-1.5">
            <Label htmlFor="source-citation" className="text-xs font-medium">
              {t('citation')}
            </Label>
            <Textarea
              id="source-citation"
              value={value.citation}
              disabled={disabled}
              onChange={(e) => set({ citation: e.target.value })}
              placeholder={t('placeholder')}
              rows={2}
              className="resize-y"
            />
          </div>
          <div className="grid content-start gap-1.5">
            <Label className="text-xs font-medium">{t('kind')}</Label>
            <Select value={value.kind} onValueChange={(kind) => set({ kind })} disabled={disabled}>
              <SelectTrigger aria-label={t('kind')}>
                <SelectValue placeholder={t('kindPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(`kinds.${k}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      <div className="grid gap-1.5 sm:max-w-xs">
        <Label className="text-xs font-medium">{t('confidence')}</Label>
        <Select value={value.confidence} onValueChange={(confidence) => set({ confidence })} disabled={disabled}>
          <SelectTrigger aria-label={t('confidence')}>
            <SelectValue placeholder={t('confidencePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {CONFIDENCE_LEVELS.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`confidenceLevels.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {complete ? t('answered') : t('required')}
      </p>
    </div>
  );
}
