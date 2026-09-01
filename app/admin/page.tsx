import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "관리자",
  description: "韩国旅行助手 관리자 페이지",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 lg:px-6">
      <section className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl shadow-slate-900/10">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-teal-100 ring-1 ring-white/10">
          <ShieldCheck size={16} aria-hidden="true" />
          관리자
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-normal">韩国旅行助手 관리자</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
          사용자 장소 제보를 검수하고, 부족한 데이터를 보완해 최종 장소로 등록합니다.
        </p>
      </section>

      <section className="mt-8">
        <AdminShell />
      </section>
    </main>
  );
}
