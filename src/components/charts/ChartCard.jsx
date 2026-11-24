import SectionCard from '../common/SectionCard';
import SampleDataBadge from '../badges/SampleDataBadge';

/** SectionCard for charts; `sample` adds the Sample data badge, `badge` any other source badge. */
export default function ChartCard({ sample = false, badge, ...rest }) {
  return <SectionCard badge={badge || (sample ? <SampleDataBadge /> : null)} {...rest} />;
}
