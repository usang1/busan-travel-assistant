import { PlaceSubmissionForm } from "@/components/PlaceSubmissionForm";
import { legalMetadata } from "@/components/LegalPage";
import { siteConfig } from "@/config/site";

export const metadata = legalMetadata(
  "联系方式",
  "釜山旅行助手 문의 및 운영자 연락처",
  "/contact",
);

export default function ContactPage() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-5">
      <div className="mb-6">
        <PlaceSubmissionForm />
      </div>
      <section className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-teal-900/10">
        <h1 className="text-3xl font-black tracking-normal">联系方式</h1>
        <p className="mt-2 text-sm text-slate-300">문의</p>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          서비스 문의, 장소 정보 수정 요청, 제휴 문의를 받을 수 있는 기본 연락처입니다.
        </p>
      </section>
      <section className="mt-5 rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-black text-slate-950">Email</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {siteConfig.contactEmail} - 실제 출시 전 운영 이메일로 변경하세요.
        </p>
      </section>
    </main>
  );
}
