'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { fetchContributorConsent, updateContributorConsent, type ContributorConsent } from '@/lib/contributor-consent';
import { glassCard } from '@/lib/design';

interface ContributorVisibilityCardProps {
  token?: string;
}

/** The contributor terms someone accepted, and the leaderboard opt-out. */
export function ContributorVisibilityCard({ token }: ContributorVisibilityCardProps) {
  const t = useTranslations('contribute.terms.account');
  const format = useFormatter();
  const [consent, setConsent] = useState<ContributorConsent | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchContributorConsent(token)
      .then(setConsent)
      .catch(() => setConsent(null));
  }, [token]);

  if (!consent) return null;

  const toggle = async (show: boolean) => {
    setSaving(true);
    try {
      setConsent(await updateContributorConsent(token, { show_on_leaderboard: show }));
    } catch {
      toast.error(t('leaderboardHelp'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className={glassCard}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="size-5" aria-hidden />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          {consent.accepted && consent.accepted_at
            ? t('accepted', {
                version: consent.accepted_version ?? consent.terms_version,
                date: format.dateTime(new Date(consent.accepted_at), { dateStyle: 'medium' }),
              })
            : t('notAccepted')}
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="show-on-leaderboard" className="font-medium">
              {t('leaderboard')}
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">{t('leaderboardHelp')}</p>
          </div>
          <Switch
            id="show-on-leaderboard"
            checked={consent.show_on_leaderboard}
            disabled={saving}
            onCheckedChange={(v) => void toggle(v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('erasure')}</p>
      </CardContent>
    </Card>
  );
}
