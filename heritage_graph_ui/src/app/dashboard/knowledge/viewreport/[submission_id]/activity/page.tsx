'use client';

import SubmissionLayout from '../Layout';

export default function SubmissionSummaryPage({
  params,
}: {
  params: { submission_id: string };
}) {
  return (
    <SubmissionLayout submissionId={params.submission_id} commentsCount={0}>
      <div className="p-6 text-center text-gray-700 text-2xl font-semibold">
        Hello World from activity
      </div>
    </SubmissionLayout>
  );
}
