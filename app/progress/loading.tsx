export default function Loading() {
  return (
    <div className="container page" aria-busy="true" aria-live="polite">
      <div className="skeleton skeleton--eyebrow" />
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--sub" />
      <div className="skeleton-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div className="skeleton skeleton--card" key={i} />
        ))}
      </div>
    </div>
  )
}
