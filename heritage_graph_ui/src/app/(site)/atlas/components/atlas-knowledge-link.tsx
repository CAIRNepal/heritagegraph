'use client';

import { IconExternalLink } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { atlasEntityHasKnowledgeLink, getAtlasKnowledgeHref } from '@/lib/atlas-entity-links';
import type { AtlasEntity } from '@/types/atlas';

interface AtlasKnowledgeLinkProps {
  entity: AtlasEntity;
  size?: 'sm' | 'default';
  className?: string;
}

export function AtlasKnowledgeLink({ entity, size = 'sm', className }: AtlasKnowledgeLinkProps) {
  const t = useTranslations('Atlas');
  if (!atlasEntityHasKnowledgeLink(entity)) return null;

  const href = getAtlasKnowledgeHref(entity);
  if (!href) return null;

  return (
    <Button
      asChild
      type="button"
      variant="outline"
      size={size}
      className={className}
    >
      <Link href={href} target="_blank" rel="noopener noreferrer">
        <IconExternalLink className="mr-1 h-3.5 w-3.5" aria-hidden />
        {t('openKnowledgeRecord')}
      </Link>
    </Button>
  );
}
