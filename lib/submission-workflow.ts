import type { SubmissionStatus } from "@/types/database";

export const reviewStatuses = ["pending", "reviewing", "rejected", "duplicate"] as const;
export type ReviewStatus = (typeof reviewStatuses)[number];

export function canChangeSubmissionStatus(current: SubmissionStatus, next: SubmissionStatus) {
  if (current === "approved" || next === "approved" || current === next) return false;
  if (current === "pending" || current === "reviewing") return reviewStatuses.includes(next as ReviewStatus);
  return next === "reviewing";
}

export function canApproveSubmission(status: SubmissionStatus) {
  return status === "pending" || status === "reviewing";
}
