import { SearchX } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <SearchX size={22} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
