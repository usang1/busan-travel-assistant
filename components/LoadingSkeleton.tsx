export function LoadingSkeleton() {
  return (
    <div className="space-y-3 rounded-[24px] bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="aspect-[16/10] animate-pulse rounded-[20px] bg-slate-200" />
      <div className="h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
      <div className="h-4 w-1/2 animate-pulse rounded-full bg-slate-100" />
      <div className="flex gap-2">
        <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
        <div className="h-7 w-20 animate-pulse rounded-full bg-slate-100" />
      </div>
    </div>
  );
}
