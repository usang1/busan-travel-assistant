import Link from "next/link";
import { siteConfig } from "@/config/site";

const legalLinks = [
  { href: "/service-info", zh: "服务说明", ko: "서비스 안내" },
  { href: "/privacy", zh: "隐私政策", ko: "개인정보처리방침" },
  { href: "/terms", zh: "使用条款", ko: "이용약관" },
  { href: "/contact", zh: "联系方式", ko: "문의" },
];

export function Footer() {
  return (
    <footer className="mx-auto max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+104px)] pt-10 text-sm text-slate-500">
      <div className="rounded-[24px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="font-black text-slate-950">{siteConfig.name}</p>
        <p className="mt-2 leading-6">{siteConfig.description}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-2xl bg-slate-50 px-3 py-3 text-slate-700 transition hover:bg-slate-100">
              <span className="block font-bold">{link.zh}</span>
              <span className="mt-1 block text-xs text-slate-500">{link.ko}</span>
            </Link>
          ))}
        </div>
        <p className="mt-5 text-xs leading-5 text-slate-400">
          信息可能会发生变化，请出发前再次确认。정보가 변경될 수 있으니 방문 전 다시 확인하세요.
        </p>
      </div>
    </footer>
  );
}
