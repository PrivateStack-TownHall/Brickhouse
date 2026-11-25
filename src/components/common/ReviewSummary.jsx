import {
  AppWindow, Hash, Building2, FolderKanban, Layers, Activity, Target, Globe,
  BookOpen, Tags, AlignLeft, Blocks, Monitor, Server, Cloud, Code2, Cpu,
  Database, Wrench, GitBranch, Boxes, Plug, ShieldCheck, Clock, Eye, Network,
  GitCommitHorizontal, GitPullRequest, Users, Rocket, MapPin, Briefcase, Tag,
  FileText, History, Link2, Sparkles,
} from 'lucide-react';

const SECTION_ICONS = [
  [/basic|general|entry/i, FileText],
  [/technical|stack/i, Cpu],
  [/relation/i, Link2],
  [/repositor/i, GitBranch],
  [/component/i, Boxes],
  [/deploy/i, Rocket],
  [/api/i, Plug],
  [/audit/i, History],
  [/application/i, AppWindow],
];

const LABEL_ICONS = [
  [/^(application name|name|provider application|parent application|related application|application \(derived\)|applications)$/i, AppWindow],
  [/^(code|version|version \/ release)$/i, Hash],
  [/^(company|organization|organization \/ group|provider)$/i, Building2],
  [/^category$/i, FolderKanban],
  [/^(type|service type|resource type)$/i, Layers],
  [/^(lifecycle|status|access status)$/i, Activity],
  [/^(visibility|exposure)$/i, Eye],
  [/^purpose$/i, Target],
  [/^(website|url|base url|deployment url|health check url|dashboard)$/i, Globe],
  [/^documentation$/i, BookOpen],
  [/^(tags|topics)$/i, Tags],
  [/^description$/i, AlignLeft],
  [/^architecture$/i, Blocks],
  [/^(platform|hosting platform)$/i, Monitor],
  [/^hosting$/i, Server],
  [/^environments?$/i, Cloud],
  [/^(programming language|language)$/i, Code2],
  [/^(frontend technology|backend technology|technologies)$/i, Cpu],
  [/^(database|orm \/ data access)$/i, Database],
  [/^additional tools$/i, Wrench],
  [/^capabilities$/i, Sparkles],
  [/^(repositories|repository|primary branch|branch|branch \/ source|active branches)$/i, GitBranch],
  [/^(components|shared components|component|depends on|also includes)$/i, Boxes],
  [/^(apis provided|apis consumed|provides apis|consumes apis|consumers)$/i, Plug],
  [/^protocol$/i, Network],
  [/^authentication$/i, ShieldCheck],
  [/^infrastructure$/i, Server],
  [/^(created|updated|last updated|deployed at|record updated|last commit)$/i, Clock],
  [/^commits$/i, GitCommitHorizontal],
  [/^pull requests$/i, GitPullRequest],
  [/^(contributors|used by applications|used by components)$/i, Users],
  [/^deploy method$/i, Rocket],
  [/^region$/i, MapPin],
  [/^role$/i, Briefcase],
];

function resolveSectionIcon(section) {
  if (section.icon) return section.icon;
  const match = SECTION_ICONS.find(([re]) => re.test(section.title || ''));
  return match ? match[1] : FileText;
}

function resolveFieldIcon(field) {
  if (field.icon) return field.icon;
  const match = LABEL_ICONS.find(([re]) => re.test(field.label || ''));
  return match ? match[1] : Tag;
}

export default function ReviewSummary({ sections }) {
  return (
    <div className="d-flex flex-column gap-4">
      {sections.map((s) => {
        const SectionIcon = resolveSectionIcon(s);
        return (
          <div key={s.title || 'section'}>
            {s.title && (
              <div className="bh-section-title">
                <SectionIcon size={15} className="bh-section-icon" />
                <span>{s.title}</span>
              </div>
            )}
            <div className="bh-review-grid">
              {s.fields.map((f) => {
                const FieldIcon = resolveFieldIcon(f);
                return (
                  <div key={f.label} className="bh-review-item" style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
                    <div className="bh-review-label">
                      <FieldIcon size={13} className="bh-review-label-icon" />
                      <span>{f.label}</span>
                    </div>
                    <div className="bh-review-value">{isEmpty(f.value) ? <span className="text-subtle">—</span> : f.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
