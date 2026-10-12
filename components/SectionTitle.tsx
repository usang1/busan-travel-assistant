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
        <Heading className="break-words text-[clamp(1.35rem,2.5vw,2rem)] font-extrabold tracking-[-0.035em] text-[#252824]">{title}</Heading>
        {subtitle ? <p className="mt-1.5 text-sm leading-6 text-[#6f746e]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
