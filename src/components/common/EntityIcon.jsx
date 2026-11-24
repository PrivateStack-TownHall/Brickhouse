import { Building2, AppWindow, GitBranch, Boxes, Rocket, Plug, Cpu, Server, Route, Activity, FileClock } from 'lucide-react';

export const ENTITY_ICONS = {
  companies: Building2, applications: AppWindow, repositories: GitBranch, components: Boxes, deployments: Rocket,
  apis: Plug, technologies: Cpu, infrastructure: Server, endpoints: Route, activities: Activity, reviews: FileClock,
};
export const ENTITY_TONES = {
  companies: 'navy', applications: 'orange', repositories: 'info', components: 'success', deployments: 'warning',
  apis: 'info', technologies: 'navy', infrastructure: 'gray', endpoints: 'gray', activities: 'gray', reviews: 'gray',
};

export default function EntityIcon({ entity, size = 16, boxed = false }) {
  const Icon = ENTITY_ICONS[entity] || Boxes;
  if (!boxed) return <Icon size={size} />;
  return <span className={`bh-rel-icon bh-tone-${ENTITY_TONES[entity] || 'gray'}`}><Icon size={size} /></span>;
}
