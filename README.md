# BRICKHOUSE – Application Registry

**Register. Connect. Visualize. Manage.**

BRICKHOUSE is the application registry and digital ecosystem inventory for VSG Group. It is a single
source of truth for applications, the companies that own them, and their repositories, components, APIs
and services, technologies, infrastructure and deployments, all connected through normalized relationships.

Version 1.0 runs entirely in the browser for a single user. There is no backend, no authentication and no cloud sync.

## Run it

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static build in dist/
npm run build:single   # one self-contained dist-single/index.html (opens straight from disk)
```

Stack: React 19 · Vite · JavaScript (ES modules) · React Router 7 · Bootstrap 5.3 · lucide-react ·
Manrope and Lora (self-hosted through @fontsource). Charts and the architecture graph are plain SVG,
so there are no extra charting or graph dependencies. Git synchronization uses the browser's native Fetch API.

Routing uses hash URLs (`#/applications/APP-001`), so the build works on any static host and from `file://`.

## Pages

| Group | Page | Highlights |
|---|---|---|
| Workspace | Overview | Summary cards, lifecycle donut, Git commit activity chart (recorded commits, 7/30/90 days), recently updated applications, Quick Access, Registry Health |
| Registry | Applications | Lifecycle summary, filters, table, 4-step Create/Edit wizard, tabbed detail (Overview, Repositories, APIs & Services, Technology Stack, Infrastructure, Deployments, Activity) |
| | Repositories | Provider and visibility summary, 3-step wizard, detail with apps, components and deployments |
| | Components | Layer and type summary, 3-step wizard (parent app, repos, techs with version, infra, APIs, dependencies) |
| | Deployments | Environment tabs, 3-step wizard; status is maintained by hand, with no live monitoring |
| Services | APIs & Services | Provider vs. consumer, 3-step wizard, endpoint management (GET/POST/PUT/PATCH/DELETE) |
| Catalog | Technology Stack | Master catalog. Unused entries stay listed. Detail shows usage and version by usage |
| | Infrastructure | Master catalog of provider **resources**, plus resources by provider |
| Visualization | Architecture Map | Data-driven SVG graph: Ecosystem, Application, Infrastructure and Dependency views; zoom, pan, search, type filters, node details, relationship highlighting, legend, fit to screen |
| Management | Progress & Review | Git analytics dashboard (not an approval workflow): metrics, commit activity (7D–1Y, by day/week/month), distribution by project, project progress table, recorded commit list, heatmap; contributors, branches and PRs once that data exists |
| | Activity Log | Append-only log of registry changes with date, type, resource and application filters |
| | Data Management | Data overview, datasets, entities, relationships, data-quality checks, change history, **backup / restore / reset** |
| | Settings | General, preferences (light/dark/system, date and time format), the five companies, registry option lists, integration configuration, system information |

## UI building blocks

The mockup patterns are shared components, so every page uses the same ones:

| Component | Used for |
|---|---|
| `components/data/DataView` | List pages: search, filters, **table ⇄ grid** switch (remembered per page), sorting, pagination with rows per page |
| `components/data/EntityCard` | Grid card for any record (avatar, title, status, ID chip, description, tags, meta, actions) |
| `components/tables/Table`, `TableFooter`, `DataTable` | Tables with sorting and "Rows per page" |
| `components/tables/RowActions` + `common/ActionMenu` | View (eye) + "…" menu with View / Edit / Delete, in tables and on cards |
| `common/StatCard` (`lg` / `md`), `SummaryCards`, `Trend`, `BrickPattern` | Metric tiles with trend line and the brick corner |
| `common/SectionCard`, `charts/ChartCard` | Card header with orange icon, serif title, subtitle, actions |
| `common/Avatar`, `IdChip`, `SelectMenu`, `QuickLinkGrid`, `MetricList`, `ProgressBar`, `charts/StackedBar` | Smaller mockup patterns |

## Architecture

```
src/
  app/            App.jsx (providers), routes.jsx (hash router, breadcrumbs via route handles)
  components/     layout/ common/ forms/ tables/ charts/ dialogs/ badges/  (shared UI)
  features/       one folder per page / module
  hooks/          useRegistry (dataset context), useToast, useFormat, useFilters, useDeleteRecord
  services/       business logic, no React:
    schema.js                 entities, relationship collections, foreign keys, canonical values
    seed.js                   imports database/*.json (read-only)
    storage.service.js        Local Storage init, persistence, migrations, reset
    id-generator.service.js   PREFIX-001 IDs from persistent counters
    activity.service.js       Activity Log writer
    validation.service.js     record validation, data-quality scan, backup validation
    registry.service.js       create / update / delete, junction sync, dependency checks
    query.service.js          read-side lookups and relationship traversal
    export.service.js / import.service.js   backup and validated restore
    git-analytics.service.js  Git analytics from recorded commits (or labelled sample data)
  helpers/index.js  formatting helpers
  utils/options.js  select options built from registry records
database/         seed JSON (see database/README.md)
scripts/          import_workbook.py — rebuilds the seed from the registry workbook
```

Every write goes through `run(serviceFn, ...args)`. The service returns a new dataset. The provider
persists it to Local Storage and re-renders. Services are pure functions, so business logic stays out of components.

### Data integrity

- IDs use `PREFIX-001` and never change. A new record takes the **lowest free number**, so a deleted
  ID is given out again and numbering never skips (delete APP-041 and the next application is APP-041
  again). Exceptions are **API** IDs, which the registry workbook locks ("never reuse"), and the
  append-only Activity Log. The policy lives in `LOCKED_ID_PREFIXES` in `services/schema.js`.
  IDs are never derived from array length.
- Deleting is blocked while a record is still referenced through a required foreign key (for example
  an application that still has components). The dialog lists the dependents. Junction links and
  optional references are unlinked in the same step, after confirmation.
- Detail pages offer safe **unlink** for individual relationships.
- Every create, update, lifecycle change, relationship change, delete and data operation writes an Activity Log entry.
- Restore validates structure, schema version and referential integrity, then shows a preview. It
  needs `RESTORE` typed to confirm. Reset needs `RESET`. Unreadable stored data is never overwritten:
  it is kept and the app runs read-only until you restore or reset.

## Data

The seed data is the VSG GitHub Repository Registry workbook, imported by `scripts/import_workbook.py`
(see `database/README.md` for the mapping and the values that still need review).

## Honest-data rules

- Progress & Review and the Overview commit chart use the **recorded commits** in the registry.
  These are a GitHub snapshot (23 commits), labelled "Recorded snapshot". Branches, pull requests
  and authors are shown as "not recorded" because the snapshot does not contain them. Only when no
  commits are recorded do the dashboards fall back to generated, labelled **sample data**.
- Integrations support multiple GitHub, GitLab and Bitbucket Cloud configurations. **Sync commits** imports provider snapshots into the registry; tokens stay in page memory and are never saved to Local Storage or backups. A successful sync is labelled **Snapshot synced**, not a persistent connection.
- Deployments and infrastructure show recorded status only. There is no live health or utilization data.

## Git integrations

Open **Settings → Integrations → Add integration**. Give each account or organization its own
name, provider, namespace and API URL. You can add two or more entries for the same provider.
Existing provider configurations are retained when loading older registry data or backups.

Repositories must already be registered with a matching provider, HTTPS repository URL and
organization/user/group path. GitLab subgroups and self-hosted GitLab or GitHub Enterprise are
supported; self-hosted APIs must permit browser CORS access. Bitbucket uses the Cloud API.

Public repositories can sync without a token. Private repositories require a token with read access:
[GitHub Contents (read)](https://docs.github.com/en/rest/commits/commits),
[GitLab read_api](https://docs.gitlab.com/api/rest/authentication/), or
[Bitbucket repository read access](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-commits/).
Enter it on the integration card and choose **Sync commits**. Leaving this page or reloading clears
the token. Each sync reads up to **500 latest primary-branch commits per matching repository**.
Limits and individual failures are reported; existing commits are retained, including when a request
fails or an integration is removed. Repeated syncs update matching SHAs without duplicating them.
The saved commits appear in repository details, Overview and Progress & Review. Branch and PR
analytics are not imported. No remote repository is modified.

Run the integration regression checks with `node scripts/test-git-integrations.mjs` (Node 24).
