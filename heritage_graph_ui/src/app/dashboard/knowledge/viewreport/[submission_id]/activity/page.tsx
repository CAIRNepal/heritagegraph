'use client';

import SubmissionLayout from '../Layout';

export default function SubmissionSummaryPage({
  params,
}: {
  params: { submission_id: string };
}) {
  return (
    <SubmissionLayout submissionId={params.submission_id} commentsCount={0}>
      <div className="p-6 text-center text-gray-700">
        <h2 className="text-2xl font-semibold">Submission Summary</h2>
        <p className="mt-2 text-base">
          This is the summary view for submission{' '}
          <span className="font-mono">{params.submission_id}</span>. You can add
          detailed information, visualizations, or key highlights here.
        </p>
      </div>
    </SubmissionLayout>
  );
}
