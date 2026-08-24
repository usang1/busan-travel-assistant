import type { Metadata } from "next";
import { Database, ShieldCheck } from "lucide-react";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AdminPlaceManager } from "@/components/AdminPlaceManager";
import { getPhotoSpots } from "@/lib/photo-spot-store";
import { getPlaces } from "@/lib/place-store";
import { isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자",
  description: "釜山旅行助手 MVP 관리자 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminPage() {
  const { places, source, error } = await getPlaces({ activeOnly: false });
  const { photoSpots } = await getPhotoSpots();

  return (
    <main className="mx-auto max-w-5xl px-4 pb-10 pt-6">
      <section className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-100 ring-1 ring-white/10">
          <ShieldCheck size={16} aria-hidden="true" />
          관리자 MVP
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">釜山旅行助手 관리자</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          광안리 MVP 콘텐츠를 등록, 수정, 삭제하고 사용자 화면에 노출합니다. 인증은 다음 단계에서 Supabase Auth로 감쌀 수 있도록 분리했습니다.
        </p>
      </section>

      <AdminDashboard places={places} photoSpots={photoSpots} />

      <section className="mt-8 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-700">
            <Database size={21} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-bold text-slate-950">Supabase 연결 상태</h2>
            <p className="mt-1 text-sm text-slate-500">
              {isSupabaseConfigured
                ? "환경 변수가 설정되어 있습니다. migration 적용 후 DB CRUD가 동작합니다."
                : "환경 변수가 없어 demo fallback과 브라우저 localStorage로 동작합니다."}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <AdminPlaceManager
          initialPlaces={places}
          source={source}
          error={error}
          supabaseConfigured={isSupabaseConfigured}
        />
      </section>
    </main>
  );
}
