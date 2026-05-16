import { NextResponse } from 'next/server';
import heritageData from '@/data/heritage-demo.json';

export async function GET() {
  return NextResponse.json(heritageData);
}
