export default function PageHeader({ title, description, actions, meta }) {
  return (
    <div className="bh-page-header">
      <div className="min-w-0">
        {meta && <div className="mb-1">{meta}</div>}
        <h1 className="bh-page-title">{title}</h1>
        {description && <p className="bh-page-desc">{description}</p>}
      </div>
      {actions && <div className="d-flex gap-2 flex-wrap align-items-center">{actions}</div>}
    </div>
  );
}
