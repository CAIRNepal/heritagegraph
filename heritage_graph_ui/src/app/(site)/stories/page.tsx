import { StoriesClient } from './stories-client';

export const metadata = {
  title: 'Stories · HeritageGraph',
  description: 'Stories built from the HeritageGraph knowledge graph: places, festivals, deities and traditions of Nepal, each link with its source.',
};

export default function StoriesPage() {
  return <StoriesClient />;
}
