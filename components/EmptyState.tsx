import { SearchX } from "lucide-react";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="border border-dashed border-[#d6d0c7] bg-white px-5 py-12 text-center">
      <div className="mx-auto grid size-12 place-items-center bg-[#edf2eb] text-[#4f6652]">
        <SearchX size={22} aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[#252824]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6f746e]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
