type SectionTitleProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  as?: "h1" | "h2";
};

export function SectionTitle({ title, subtitle, action, as: Heading = "h2" }: SectionTitleProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <Heading className="break-words text-xl font-bold tracking-normal text-slate-950">{title}</Heading>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
