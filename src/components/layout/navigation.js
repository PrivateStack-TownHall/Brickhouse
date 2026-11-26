import {
  LayoutDashboard, AppWindow, GitBranch, Boxes, Rocket, Plug, Cpu, Server, Network, GitPullRequest, History, Database, Settings, Bell, Image as ImageIcon,
} from 'lucide-react';

export const NAV_GROUPS = [
  { label: 'WORKSPACE', items: [{ to: '/', label: 'Overview', icon: LayoutDashboard, end: true }] },
  {
    label: 'REGISTRY',
    items: [
      { to: '/applications', label: 'Applications', icon: AppWindow },
      { to: '/repositories', label: 'Repositories', icon: GitBranch },
      { to: '/components', label: 'Components', icon: Boxes },
      { to: '/deployments', label: 'Deployments', icon: Rocket },
    ],
  },
  { label: 'SERVICES', items: [{ to: '/apis', label: 'APIs & Services', icon: Plug }] },
  {
    label: 'CATALOG',
    items: [
      { to: '/technologies', label: 'Technology Stack', icon: Cpu },
      { to: '/infrastructure', label: 'Infrastructure', icon: Server },
    ],
  },
  { label: 'VISUALIZATION', items: [{ to: '/architecture', label: 'Architecture Map', icon: Network }] },
  {
    label: 'MANAGEMENT',
    items: [
      { to: '/progress', label: 'Progress & Review', icon: GitPullRequest },
      { to: '/activity', label: 'Activity Log', icon: History },
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/images', label: 'Images', icon: ImageIcon },
      { to: '/data', label: 'Data Management', icon: Database },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];
