/** Read-only field grid used by wizard review steps and detail pages.
 * sections: [{ title, fields: [{ label, value }] }] */
export default function ReviewSummary({ sections }) {
  return (
    <div className="d-flex flex-column gap-4">
      {sections.map((s) => (
        <div key={s.title}>
          {s.title && <div className="bh-section-title">{s.title}</div>}
          <div className="bh-review-grid">
            {s.fields.map((f) => (
              <div key={f.label} style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
                <div className="bh-review-label">{f.label}</div>
                <div className="bh-review-value">{isEmpty(f.value) ? <span className="text-subtle">—</span> : f.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
