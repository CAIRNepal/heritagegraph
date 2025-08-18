'use client';

import SubmissionLayout from '../Layout';
import CommentSection from '@/components/heritage-commenting';

// Dummy comments data
const dummyComments: Comment[] = [
  {
    id: 1,
    author: 'historian_pro',
    content:
      "This is a fascinating discovery! The architectural style matches other Mauryan-era structures I've studied. Have you found any inscriptions?",
    timestamp: '2023-05-16T08:45:00Z',
    votes: 12,
    isTopPoster: true,
    replies: [
      {
        id: 3,
        author: 'archaeology_lover',
        content:
          'Yes! We found a small fragment with Brahmi script. Still being deciphered.',
        timestamp: '2023-05-16T10:20:00Z',
        votes: 5,
      },
    ],
  },
  {
    id: 2,
    author: 'Moderator',
    content:
      'Please provide more detailed photographs of the carvings for verification purposes.',
    timestamp: '2023-05-15T14:30:00Z',
    votes: 8,
    isModerator: true,
  },
  {
    id: 4,
    author: 'art_history_buff',
    content:
      'The lotus motifs are particularly interesting. They resemble those found at Sanchi but with some local variations.',
    timestamp: '2023-05-17T11:15:00Z',
    votes: 7,
  },
];

export default function SubmissionSummaryPage({
  params,
}: {
  params: { submission_id: string };
}) {
  return (
    <SubmissionLayout submissionId={params.submission_id} commentsCount={10}>
      <br />
      <CommentSection comments={dummyComments} />
    </SubmissionLayout>
  );
}
