"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import {
  anonymousSessionStorageKey,
  entitlementStorageKey,
  getEntitlementRemainingDays,
  isEntitlementActive,
  type ProEntitlement,
} from "@/lib/entitlements";

type ProEntitlementContextValue = {
  entitlement: ProEntitlement | null;
  isPro: boolean;
  remainingDays: number;
  anonymousSessionId: string;
  activatePro: (entitlement: ProEntitlement) => void;
  clearPro: () => void;
};

const ProEntitlementContext = createContext<ProEntitlementContextValue | null>(null);

function readEntitlementSnapshot() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(entitlementStorageKey) ?? "";
}

function parseEntitlement(snapshot: string) {
  if (!snapshot) {
    return null;
  }

  try {
    return JSON.parse(snapshot) as ProEntitlement;
  } catch {
    return null;
  }
}

function getAnonymousSessionId() {
  if (typeof window === "undefined") {
    return "server-session";
  }

  const existing = window.localStorage.getItem(anonymousSessionStorageKey);

  if (existing) {
    return existing;
  }

  const created = `anon_${crypto.randomUUID()}`;
  window.localStorage.setItem(anonymousSessionStorageKey, created);
  return created;
}

function notifyEntitlementChange() {
  window.dispatchEvent(new Event("pro-entitlement-change"));
}

export function ProEntitlementProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      window.addEventListener("pro-entitlement-change", onStoreChange);

      return () => {
        window.removeEventListener("storage", onStoreChange);
        window.removeEventListener("pro-entitlement-change", onStoreChange);
      };
    },
    readEntitlementSnapshot,
    () => "",
  );

  const entitlement = useMemo(() => parseEntitlement(snapshot), [snapshot]);
  const isPro = isEntitlementActive(entitlement);
  const anonymousSessionId = useMemo(() => getAnonymousSessionId(), []);

  const value = useMemo<ProEntitlementContextValue>(
    () => ({
      entitlement,
      isPro,
      remainingDays: getEntitlementRemainingDays(entitlement),
      anonymousSessionId,
      activatePro: (nextEntitlement) => {
        window.localStorage.setItem(entitlementStorageKey, JSON.stringify(nextEntitlement));
        notifyEntitlementChange();
      },
      clearPro: () => {
        window.localStorage.removeItem(entitlementStorageKey);
        notifyEntitlementChange();
      },
    }),
    [anonymousSessionId, entitlement, isPro],
  );

  return <ProEntitlementContext.Provider value={value}>{children}</ProEntitlementContext.Provider>;
}

export function useProEntitlement() {
  const context = useContext(ProEntitlementContext);

  if (!context) {
    throw new Error("useProEntitlement must be used within ProEntitlementProvider");
  }

  return context;
}
