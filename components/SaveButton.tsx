"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { pendingPlaceSaveStorageKey } from "@/lib/auth-flow";
import { recordPlaceEvent } from "@/lib/place-events";
import { getPlaceSaveCounts } from "@/lib/place-saves";
import { savedItemsStorageKey, type SavedItem } from "@/lib/saved-items";
import { getSupabaseClient } from "@/lib/supabase";
import { defaultLocale, getLocaleFromPath, type Locale, withLocale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type SaveButtonProps = {
  item: Omit<SavedItem, "savedAt">;
  initialSaveCount?: number;
  className?: string;
  label?: string;
  locale?: Locale;
};

const saveLabels: Record<Locale, { save: string; saved: string; loginRequired: string }> = {
  zh: { save: "保存", saved: "已保存", loginRequired: "登录后保存" },
  en: { save: "Save", saved: "Saved", loginRequired: "Sign in to save" },
  ja: { save: "保存", saved: "保存済み", loginRequired: "ログインして保存" },
  ko: { save: "저장", saved: "저장됨", loginRequired: "로그인 후 저장" },
};

type PlaceSaveChangeDetail = {
  placeId?: string;
  saved?: boolean;
  saveCount?: number;
};

type PlaceSaveStateRow = {
  saved: boolean;
  save_count: number | string;
};

function readItems() {
  try {
    return JSON.parse(window.localStorage.getItem(savedItemsStorageKey) ?? "[]") as SavedItem[];
  } catch {
    return [];
  }
}

function writeItems(items: SavedItem[]) {
  window.localStorage.setItem(savedItemsStorageKey, JSON.stringify(items));
  window.dispatchEvent(new Event("saved-items-change"));
}

export function SaveButton({ item, initialSaveCount = 0, className, label, locale }: SaveButtonProps) {
  if (item.type === "place") {
    return (
      <PlaceSaveButton
        item={item}
        initialSaveCount={initialSaveCount}
        className={className}
        label={label}
        locale={locale}
      />
    );
  }

  return <LegacySaveButton item={item} className={className} label={label} locale={locale} />;
}

function PlaceSaveButton({ item, initialSaveCount, className, label, locale }: SaveButtonProps & { initialSaveCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const derivedLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const text = saveLabels[derivedLocale];
  const { user, loading } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saveCount, setSaveCount] = useState(initialSaveCount);
  const [pending, setPending] = useState(false);
  const client = getSupabaseClient();

  useEffect(() => {
    let mounted = true;

    async function loadState() {
      if (!client) {
        return;
      }

      const counts = await getPlaceSaveCounts([item.id]);

      if (mounted && counts.has(item.id)) {
        setSaveCount(counts.get(item.id) ?? 0);
      }

      if (!user) {
        if (mounted) {
          setSaved(false);
        }
        return;
      }

      const { data } = await client
        .from("place_saves")
        .select("id")
        .eq("user_id", user.id)
        .eq("place_id", item.id)
        .maybeSingle();

      if (mounted) {
        setSaved(Boolean(data));
      }
    }

    void loadState();

    function handleSaveChange(event: Event) {
      const detail = (event as CustomEvent<PlaceSaveChangeDetail>).detail;

      if (detail?.placeId && detail.placeId !== item.id) {
        return;
      }

      if (typeof detail?.saved === "boolean" && Number.isFinite(detail.saveCount)) {
        setSaved(detail.saved);
        setSaveCount(Math.max(0, Number(detail.saveCount)));
      } else {
        void loadState();
      }
    }

    window.addEventListener("place-save-change", handleSaveChange);

    return () => {
      mounted = false;
      window.removeEventListener("place-save-change", handleSaveChange);
    };
  }, [client, item.id, user]);

  function redirectToLogin() {
    const next = `${window.location.pathname}${window.location.search}`;

    window.localStorage.setItem(
      pendingPlaceSaveStorageKey,
      JSON.stringify({
        placeId: item.id,
        locale: derivedLocale,
        createdAt: new Date().toISOString(),
      }),
    );
    router.push(`${withLocale("/login", derivedLocale)}?next=${encodeURIComponent(next)}`);
  }

  async function toggleSaved() {
    if (loading || pending) {
      return;
    }

    if (!client || !user) {
      redirectToLogin();
      return;
    }

    const wasSaved = saved;
    const desiredSaved = !wasSaved;

    setPending(true);
    const rpcResult = await client.rpc("set_place_saved", {
      target_place_id: item.id,
      should_save: desiredSaved,
    });

    let authoritativeState = readPlaceSaveState(rpcResult.data);

    if (rpcResult.error || !authoritativeState) {
      // eslint-disable-next-line no-console
      console.warn("[place-save:set_place_saved] using RLS fallback", {
        code: rpcResult.error?.code ?? "invalid_response",
        message: rpcResult.error?.message ?? "The save RPC returned no state.",
      });
      authoritativeState = await applyLegacySaveState(client, user.id, item.id, desiredSaved);
    }

    if (!authoritativeState) {
      setPending(false);
      return;
    }

    setSaved(authoritativeState.saved);
    setSaveCount(authoritativeState.saveCount);

    if (authoritativeState.saved !== wasSaved) {
      await recordPlaceEvent({
        eventType: authoritativeState.saved ? "place_save" : "place_unsave",
        placeId: item.id,
        locale: derivedLocale,
        userId: user.id,
      });
    }

    setPending(false);
    window.dispatchEvent(new CustomEvent<PlaceSaveChangeDetail>("place-save-change", {
      detail: {
        placeId: item.id,
        saved: authoritativeState.saved,
        saveCount: authoritativeState.saveCount,
      },
    }));
    router.refresh();
  }

  const visibleLabel = saved ? text.saved : label ?? text.save;

  return (
    <button
      type="button"
      onClick={() => void toggleSaved()}
      disabled={pending}
      className={cn(
        "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-slate-50 px-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-rose-50 hover:text-rose-700 active:scale-95 disabled:opacity-60",
        saved && "bg-rose-50 text-rose-700 ring-rose-100",
        className,
      )}
      aria-pressed={saved}
      aria-label={user ? `${visibleLabel} ${item.titleZh}` : `${text.loginRequired} ${item.titleZh}`}
      title={user ? undefined : text.loginRequired}
    >
      <Heart size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      <span>{visibleLabel}</span>
      <span>{saveCount}</span>
    </button>
  );
}

function readPlaceSaveState(data: unknown): { saved: boolean; saveCount: number } | null {
  const row = Array.isArray(data) ? data[0] as PlaceSaveStateRow | undefined : data as PlaceSaveStateRow | null;
  const count = typeof row?.save_count === "number" ? row.save_count : Number(row?.save_count);

  if (!row || typeof row.saved !== "boolean" || !Number.isFinite(count)) {
    return null;
  }

  return { saved: row.saved, saveCount: Math.max(0, Math.round(count)) };
}

async function applyLegacySaveState(
  client: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userId: string,
  placeId: string,
  shouldSave: boolean,
) {
  const mutation = shouldSave
    ? await client.from("place_saves").upsert(
        { user_id: userId, place_id: placeId },
        { onConflict: "user_id,place_id", ignoreDuplicates: true },
      )
    : await client.from("place_saves").delete().eq("user_id", userId).eq("place_id", placeId);

  if (mutation.error) {
    // eslint-disable-next-line no-console
    console.error("[place-save:fallback] mutation failed", mutation.error);
    return null;
  }

  const [{ data: savedRow, error: stateError }, counts] = await Promise.all([
    client.from("place_saves").select("id").eq("user_id", userId).eq("place_id", placeId).maybeSingle(),
    getPlaceSaveCounts([placeId]),
  ]);
  const count = counts.get(placeId);

  if (stateError || typeof count !== "number") {
    // eslint-disable-next-line no-console
    console.error("[place-save:fallback] authoritative state unavailable", stateError);
    return null;
  }

  return { saved: Boolean(savedRow), saveCount: count };
}

function LegacySaveButton({ item, className, label, locale }: SaveButtonProps) {
  const pathname = usePathname();
  const derivedLocale = locale ?? getLocaleFromPath(pathname) ?? defaultLocale;
  const text = saveLabels[derivedLocale];
  const snapshot = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("saved-items-change", onStoreChange);
      window.addEventListener("storage", onStoreChange);

      return () => {
        window.removeEventListener("saved-items-change", onStoreChange);
        window.removeEventListener("storage", onStoreChange);
      };
    },
    () => window.localStorage.getItem(savedItemsStorageKey) ?? "[]",
    () => "[]",
  );
  const items = useMemo(() => {
    try {
      return JSON.parse(snapshot) as SavedItem[];
    } catch {
      return [];
    }
  }, [snapshot]);
  const saved = items.some((savedItem) => savedItem.id === item.id && savedItem.type === item.type);

  function toggleSaved() {
    const current = readItems();
    const exists = current.some((savedItem) => savedItem.id === item.id && savedItem.type === item.type);

    if (exists) {
      writeItems(current.filter((savedItem) => !(savedItem.id === item.id && savedItem.type === item.type)));
      return;
    }

    writeItems([{ ...item, savedAt: new Date().toISOString() }, ...current]);
  }

  return (
    <button
      type="button"
      onClick={toggleSaved}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-slate-50 px-3 text-sm font-black text-slate-700 ring-1 ring-slate-200 transition hover:bg-teal-50 hover:text-teal-700 active:scale-95",
        className,
        saved && "bg-teal-50 text-teal-700 ring-teal-100",
      )}
      aria-pressed={saved}
      aria-label={`${saved ? text.saved : text.save} ${derivedLocale === "ko" ? item.titleKo : item.titleZh}`}
    >
      <Heart size={17} fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      {label ? <span>{saved ? text.saved : label}</span> : null}
    </button>
  );
}
