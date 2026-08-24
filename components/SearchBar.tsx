import { Search } from "lucide-react";

type SearchBarProps = {
  compact?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
};

export function SearchBar({ compact = false, value, onChange, placeholder = "搜索美食、景点、咖啡店" }: SearchBarProps) {
  return (
    <label className="block">
      <span className="sr-only">{placeholder}</span>
      <span className="relative block">
        <Search
          size={19}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          className={[
            "w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-[16px] text-slate-900 outline-none shadow-sm transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100",
            compact ? "h-12" : "h-14",
          ].join(" ")}
        />
      </span>
    </label>
  );
}
