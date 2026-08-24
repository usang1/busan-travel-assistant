type SectionTitleProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export function SectionTitle({ title, subtitle, action }: SectionTitleProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold tracking-normal text-slate-950">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
