'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { updateContributorConsent, type ContributorConsent } from '@/lib/contributor-consent';

interface ContributorTermsDialogProps {
  open: boolean;
  consent: ContributorConsent | null;
  token?: string;
  onOpenChange: (open: boolean) => void;
  onAccepted: (consent: ContributorConsent) => void;
}

/**
 * Shown before a contributor's first submission, and again when the terms change.
 * The terms come from the backend, which records the version accepted; a
 * translation is used only when it was written for that same version.
 */
export function ContributorTermsDialog({ open, consent, token, onOpenChange, onAccepted }: ContributorTermsDialogProps) {
  const t = useTranslations('contribute.terms');
  const locale = useLocale();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translated = t.raw('points') as string[];
  const sameVersion = t('version') === consent?.terms_version;
  const points = locale !== 'en' && sameVersion && Array.isArray(translated) ? translated : (consent?.terms ?? []);

  const agree = async () => {
    setSaving(true);
    setError(null);
    try {
      onAccepted(await updateContributorConsent(token, { accept: true }));
    } catch {
      setError(t('error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('intro')}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm text-foreground">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          <Link href="/terms" className="text-primary underline underline-offset-2" target="_blank">
            {t('termsLink')}
          </Link>
          {' · '}
          {t('privacyLead')}{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-2" target="_blank">
            {t('privacyLink')}
          </Link>
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>{t('cancel')}</AlertDialogCancel>
          <Button onClick={() => void agree()} disabled={saving || !consent}>
            {t('agree')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
