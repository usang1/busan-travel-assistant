export type ProEntitlement = {
  planId: string;
  provider: string;
  transactionId: string;
  activatedAt: string;
  expirationAt: string;
};

export const entitlementStorageKey = "busan-travel-assistant-pro-entitlement";
export const anonymousSessionStorageKey = "busan-travel-assistant-anonymous-session";

export function isEntitlementActive(entitlement: ProEntitlement | null, now = new Date()) {
  if (!entitlement) {
    return false;
  }

  return new Date(entitlement.expirationAt).getTime() > now.getTime();
}

export function getEntitlementRemainingDays(entitlement: ProEntitlement | null, now = new Date()) {
  if (!entitlement || !isEntitlementActive(entitlement, now)) {
    return 0;
  }

  return Math.max(1, Math.ceil((new Date(entitlement.expirationAt).getTime() - now.getTime()) / 86400000));
}
