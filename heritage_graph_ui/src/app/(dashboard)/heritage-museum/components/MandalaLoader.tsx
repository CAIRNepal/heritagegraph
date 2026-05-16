'use client';

export function MandalaLoader() {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-6">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border border-dashed border-amber-500/30 animate-[spin_4s_linear_infinite]" />
        <div className="absolute inset-2 rounded-full border border-dashed border-orange-500/20 animate-[spin_6s_linear_infinite_reverse]" />
        <div className="absolute inset-4 rounded-full border border-dashed border-yellow-500/15 animate-[spin_8s_linear_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">
          ☸
        </div>
      </div>
      <div className="text-center">
        <p className="text-amber-400 font-semibold">Loading Heritage Graph</p>
        <p className="text-gray-500 text-sm mt-1">Weaving the knowledge of Nepal…</p>
      </div>
    </div>
  );
}
