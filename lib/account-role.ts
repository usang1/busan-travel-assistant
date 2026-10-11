export const accountRoles = ["user", "tourist", "business_owner", "admin"] as const;

export type AccountRole = (typeof accountRoles)[number];

export function hasAdminAccess(role: unknown): role is "admin" {
  return role === "admin";
}

export function hasBusinessOwnerAccess(role: unknown): role is "business_owner" | "admin" {
  return role === "business_owner" || hasAdminAccess(role);
}
