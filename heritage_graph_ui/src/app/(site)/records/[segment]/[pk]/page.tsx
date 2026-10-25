import { RecordClient } from './record-client';

export const metadata = {
  title: 'Record · HeritageGraph',
  description: 'A HeritageGraph record, the threads that lead out from it, and where its content comes from.',
};

interface RecordPageProps {
  params: Promise<{ segment: string; pk: string }>;
}

export default async function RecordPage({ params }: RecordPageProps) {
  const { segment, pk } = await params;
  return <RecordClient segment={segment} pk={pk} />;
}
