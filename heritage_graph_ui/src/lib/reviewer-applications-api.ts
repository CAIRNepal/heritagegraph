import { apiFetch, apiFetchJson } from "@/lib/api-client";
import { dataApiPath } from "@/lib/api-paths";

export type ReviewerApplicationStatus = "pending" | "approved" | "rejected";

export interface ReviewerApplication {
  id: string | null;
  message: string | null;
  status: ReviewerApplicationStatus | null;
  created_at: string | null;
  updated_at: string | null;
}

function authHeaders(accessToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
}

/** Latest application for the signed-in user (empty shell when none). */
export async function fetchMyReviewerApplication(
  accessToken: string,
): Promise<ReviewerApplication> {
  return apiFetchJson<ReviewerApplication>(
    dataApiPath("reviewer-applications", "mine"),
    { headers: authHeaders(accessToken) },
  );
}

export async function submitReviewerApplication(
  accessToken: string,
  message: string,
): Promise<ReviewerApplication> {
  return apiFetchJson<ReviewerApplication>(dataApiPath("reviewer-applications"), {
    method: "POST",
    headers: authHeaders(accessToken),
    body: JSON.stringify({ message: message.trim() }),
  });
}

/** Cancel a pending application so the user can re-apply later. */
export async function withdrawMyReviewerApplication(accessToken: string): Promise<void> {
  await apiFetch(dataApiPath("reviewer-applications", "mine", "withdraw"), {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}
