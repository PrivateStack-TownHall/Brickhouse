import {
  Activity, AlertTriangle, AppWindow, Archive, Box, CheckCircle2, Code2, Cpu, Database, FlaskConical,
  GitBranch, Github, Gitlab, HardDrive, Layers, Library, Lightbulb, Link2, Monitor, Network,
  Pencil, Plug, Plus, RefreshCcw, RefreshCw, Rocket, ServerCog, Settings2, ShieldCheck, Terminal, Trash2, Wrench,
} from 'lucide-react';

export const LIFECYCLE_STYLES = {
  planning: [Lightbulb, 'navy'],
  development: [Code2, 'info'],
  testing: [FlaskConical, 'warning'],
  active: [CheckCircle2, 'success'],
  maintenance: [Wrench, 'orange'],
  archived: [Archive, 'gray'],
};

export const ACTIVITY_CATEGORY_STYLES = {
  create: [Plus, 'success'],
  update: [Pencil, 'info'],
  delete: [Trash2, 'danger'],
  lifecycle: [RefreshCcw, 'warning'],
  relationship: [Link2, 'orange'],
  system: [Settings2, 'gray'],
};

export const NOTIFICATION_KIND_META = {
  sync: { label: 'Git Sync', icon: RefreshCw },
  deployment: { label: 'Deployment', icon: Rocket },
  error: { label: 'Error', icon: AlertTriangle },
  activity: { label: 'Registry', icon: Activity },
};

export const GIT_PROVIDER_ICONS = {
  github: Github,
  gitlab: Gitlab,
  bitbucket: Box,
};

export const HTTP_METHOD_TONES = {
  GET: 'info',
  POST: 'success',
  PUT: 'warning',
  PATCH: 'orange',
  DELETE: 'danger',
};

export const TECH_GROUP_ICONS = {
  frameworks: [Layers, 'info'],
  libraries: [Library, 'success'],
  tools: [Wrench, 'warning'],
  platforms: [Terminal, 'navy'],
  databases: [Database, 'danger'],
};

export const INFRASTRUCTURE_GROUP_ICONS = {
  compute: [Cpu, 'info'],
  database: [Database, 'success'],
  storage: [HardDrive, 'warning'],
  network: [Network, 'navy'],
  security: [ShieldCheck, 'danger'],
};

export const COMPONENT_BUCKET_META = [
  { key: 'frontend', label: 'Frontend', icon: Monitor, tone: 'info' },
  { key: 'backend', label: 'Backend', icon: ServerCog, tone: 'navy' },
  { key: 'service', label: 'API / Service', icon: Plug, tone: 'success' },
  { key: 'library', label: 'Library', icon: Library, tone: 'warning' },
  { key: 'ui', label: 'UI', icon: Layers, tone: 'danger' },
];

export const BERRY_FRESH_SUMMARY = [
  { icon: AppWindow, label: 'Application', items: ['Berry Fresh (Platform E-Commerce Buah Segar)'] },
  { icon: GitBranch, label: 'Repositories', items: ['berry-fresh-web (Frontend)', 'berry-fresh-api (Backend)', 'berry-fresh-ui (Shared UI)'] },
  { icon: Plug, label: 'APIs & Services', items: ['Berry Fresh REST API (Provided)', 'Midtrans Payment API (Consumed)', 'RajaOngkir Courier API (Consumed)'] },
  { icon: Rocket, label: 'Deployments', items: ['Vercel — Production Web (berryfresh.id)', 'Render — Production API (api.berryfresh.id)', 'Vercel — Staging Preview'] },
];

export const OVERVIEW_PERIODS = [
  { value: 7, label: 'Last 7 Days' },
  { value: 30, label: 'Last 30 Days' },
  { value: 90, label: 'Last 90 Days' },
];

export const OVERVIEW_MONTH_RANGES = [
  { value: 6, label: 'Last 6 Months' },
  { value: 12, label: 'Last 12 Months' },
];

export const REPOSITORY_ACTIVITY_PERIODS = [
  { value: 'all', label: 'All recorded' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 1 year' },
];

export const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.18, ease: 'easeOut' },
};
