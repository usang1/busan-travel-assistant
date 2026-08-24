type TagChipProps = {
  children: React.ReactNode;
  tone?: "default" | "green" | "amber" | "blue";
};

const toneClass: Record<NonNullable<TagChipProps["tone"]>, string> = {
  default: "bg-slate-100 text-slate-700",
  green: "bg-teal-50 text-teal-800",
  amber: "bg-amber-50 text-amber-800",
  blue: "bg-sky-50 text-sky-800",
};

export function TagChip({ children, tone = "default" }: TagChipProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toneClass[tone]}`}>
      {children}
    </span>
  );
}
