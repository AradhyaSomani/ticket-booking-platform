export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="ticket h-28 animate-pulse bg-surface-raised/40" />
      ))}
    </div>
  )
}