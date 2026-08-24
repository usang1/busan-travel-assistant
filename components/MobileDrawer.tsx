"use client";

import { X } from "lucide-react";

type MobileDrawerProps = {
  title: string;
  open: boolean;
  children: React.ReactNode;
  onClose: () => void;
};

export function MobileDrawer({ title, open, children, onClose }: MobileDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="absolute inset-x-0 bottom-0 rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+24px)] shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-slate-100 text-slate-700"
            aria-label="关闭"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
