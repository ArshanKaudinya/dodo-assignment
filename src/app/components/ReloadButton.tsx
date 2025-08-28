"use client";

import { ArrowsCounterClockwise } from "phosphor-react";

export function ReloadButton() {
  return (
    <button
      type="button"
      aria-label="Reload"
      title="Reload"
      onClick={() => window.location.reload()}
      className="inline-flex items-center gap-1 rounded-md border border-gray-400 cursor-pointer bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
    >
      Sync
      <ArrowsCounterClockwise size={18} weight="regular" />
    </button>
  );
}
