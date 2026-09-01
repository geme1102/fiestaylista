export default function EventAdminLoadingSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <div className="flex items-center gap-4 mb-8 py-2">
        <div className="w-11 h-11 bg-surface-container-high rounded-2xl" />
        <div className="space-y-2">
          <div className="h-3 w-24 bg-surface-container-high rounded" />
          <div className="h-5 w-40 bg-surface-container-high rounded-lg" />
        </div>
        <div className="ml-auto flex items-center gap-2 bg-surface-container-high/50 px-3 py-1.5 rounded-full">
          <div className="w-2.5 h-2.5 bg-surface-container-high rounded-full" />
          <div className="h-3 w-28 bg-surface-container-high rounded" />
        </div>
      </div>

      <div className="h-4 w-48 bg-surface-container-high rounded mb-6" />

      <div className="bg-surface/80 rounded-[32px] p-6 md:p-8 border border-white/70 mb-8">
        <div className="flex flex-col sm:flex-row gap-6 pb-6 border-b border-primary/10">
          <div className="flex items-center gap-[18px]">
            <div className="w-[72px] h-[72px] bg-surface-container-high rounded-2xl" />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-48 bg-surface-container-high rounded-lg" />
                <div className="w-9 h-9 bg-surface-container-high rounded-xl" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-surface-container-high rounded-full" />
                <div className="h-6 w-16 bg-surface-container-high rounded-full" />
              </div>
              <div className="h-5 w-36 bg-surface-container-high rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-4 bg-surface-container-high/30 p-3.5 rounded-2xl self-stretch sm:self-center">
            <div className="space-y-1.5">
              <div className="h-2.5 w-24 bg-surface-container-high rounded" />
              <div className="h-3 w-20 bg-surface-container-high rounded" />
            </div>
            <div className="w-14 h-[30px] bg-surface-container-high rounded-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[18px] mt-6">
          <div className="h-14 bg-surface-container-high rounded-2xl" />
          <div className="h-14 bg-surface-container-high/50 rounded-2xl" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 pt-6 border-t border-primary/10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface-container-high/50 rounded-2xl" />
          ))}
        </div>
      </div>

      <div className="h-64 bg-surface-container-high/30 rounded-[32px]" />
    </div>
  );
}
