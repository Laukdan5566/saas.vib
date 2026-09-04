export const compassoStatuses = ["paid", "open", "overdue", "in_grace", "blocked"] as const;
export type CompassoStatus = typeof compassoStatuses[number];

export function mapCompassoAccess(status: CompassoStatus) {
  return {
    status: status === "blocked" ? "past_due" : "active",
    accessBlocked: status === "blocked"
  };
}

export function isCompassoStatus(value: unknown): value is CompassoStatus {
  return compassoStatuses.includes(value as CompassoStatus);
}
