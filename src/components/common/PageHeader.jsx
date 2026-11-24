export default function PageHeader({ title, description, actions, meta, avatar }) {
  return (
    <div className="bh-page-header">
      <div className="d-flex align-items-center gap-3 min-w-0">
        {avatar && <div className="flex-shrink-0">{avatar}</div>}
        <div className="min-w-0">
          {meta && <div className="mb-1">{meta}</div>}
          <h1 className="bh-page-title">{title}</h1>
          {description && <p className="bh-page-desc">{description}</p>}
        </div>
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap align-items-center">{actions}</div>}
    </div>
  );
}
