import { BusinessApplicationForm } from "@/components/BusinessApplicationForm";
import { SectionTitle } from "@/components/SectionTitle";
export default function Page() { return <main className="safe-bottom mx-auto max-w-3xl px-4 pb-8 pt-5"><SectionTitle as="h1" title="가게 입점 신청" subtitle="business owner application" /><div className="mt-5"><BusinessApplicationForm locale="ko" /></div></main>; }
