import { StoryClient } from './story-client';

export const metadata = {
  title: 'Story · HeritageGraph',
  description: 'A story built from the HeritageGraph knowledge graph: each stop answers a question the last one raised.',
};

interface StoryPageProps {
  params: Promise<{ segment: string; pk: string }>;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { segment, pk } = await params;
  return <StoryClient segment={segment} pk={pk} />;
}
