export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 bg-gray-200 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 rounded" />
      </div>
      {/* Toolbar */}
      <div className="flex gap-3">
        <div className="h-9 w-48 bg-gray-200 rounded-lg" />
        <div className="h-9 w-32 bg-gray-200 rounded-lg ml-auto" />
      </div>
      {/* Table skeleton */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="h-11 bg-gray-50 border-b px-4 flex items-center gap-6">
          {[120, 180, 100, 80, 100].map((w, i) => (
            <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 border-b px-4 flex items-center gap-6">
            {[80, 160, 100, 60, 90].map((w, j) => (
              <div key={j} className="h-3 bg-gray-100 rounded" style={{ width: w }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
