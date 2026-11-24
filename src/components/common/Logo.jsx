import mark from '../../assets/logos/brickhouse-mark.png';

/** Brickhouse brand lockup: the provided house mark + wordmark. */
export default function Logo({ compact = false }) {
  return (
    <div className="bh-sidebar-brand">
      <img src={mark} alt="Brickhouse logo" />
      {!compact && (
        <div>
          <div className="bh-brand-name">BRICKHOUSE</div>
          <div className="bh-brand-sub">APPLICATION REGISTRY</div>
        </div>
      )}
    </div>
  );
}
