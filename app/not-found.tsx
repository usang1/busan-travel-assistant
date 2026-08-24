import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <main className="safe-bottom mx-auto max-w-3xl px-4 pb-6 pt-8">
      <EmptyState title="没有找到页面" description="요청한 페이지를 찾을 수 없습니다." />
      <Link
        href="/"
        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-teal-700 px-4 py-3 font-semibold text-white shadow-sm"
      >
        回到首页
      </Link>
    </main>
  );
}
