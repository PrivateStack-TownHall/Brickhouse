import { cx } from '../../helpers';

/** tabs: [{ key, label, icon, count }] */
export default function DetailTabs({ tabs, active, onChange }) {
  return (
    <div className="bh-tabs" role="tablist">
      {tabs.map(({ key, label, icon: Icon, count }) => (
        <button key={key} type="button" role="tab" aria-selected={active === key} className={cx('bh-tab', active === key && 'active')} onClick={() => onChange(key)}>
          {Icon && <Icon size={15} />}{label}{count !== undefined && <span className="count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
