import { NextResponse } from 'next/server';
import heritageData from '@/data/heritage-demo.json';
import kgExtension from '@/data/heritage-demo-kg.json';

/** The curated corpus plus the records frozen from the knowledge graph. */
export async function GET() {
  const { foldedIntoCurated: _folded, ...extension } = kgExtension._provenance;
  return NextResponse.json({
    _provenance: { ...heritageData._provenance, extension },
    '@graph': [...heritageData['@graph'], ...kgExtension['@graph']],
  });
}
