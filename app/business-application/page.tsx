import { BusinessApplicationForm } from "@/components/BusinessApplicationForm";
import { SectionTitle } from "@/components/SectionTitle";
import { SubmissionTypeNavigation } from "@/components/SubmissionTypeNavigation";
export default function Page() { return <main className="safe-bottom mx-auto max-w-3xl px-4 pb-8 pt-5"><SectionTitle as="h1" title="Spotzari 입점신청" subtitle="가게 정보를 등록하고 해외 여행자에게 소개해 보세요." /><div className="mt-5"><SubmissionTypeNavigation active="business" locale="ko" /></div><div className="mt-4"><BusinessApplicationForm locale="ko" /></div></main>; }
