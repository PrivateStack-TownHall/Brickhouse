# BRICKHOUSE seed database

These JSON files are the **initial / master seed data**. On first launch BRICKHOUSE copies them
into browser Local Storage (`brickhouse.registry`) and from then on works only on that runtime
copy. Runtime operations never modify these files. Use *Data Management → Reset to Seed Data* to
start over from them.

The seed is **imported from the VSG GitHub Repository Registry workbook**
(`VSG_Repository_Registry_Git_Activity_CLEAN.xlsx`) by `scripts/import_workbook.py`:
40 applications, 32 GitHub repositories (29 accessible, 3 returning 404), 12 APIs, 6 components,
2 GitHub organizations and 23 recorded commits. The technology catalog is a generic starter list
that the workbook does not cover.

Re-import after the workbook changes:

```bash
pip install openpyxl
python3 scripts/import_workbook.py path/to/workbook.xlsx --backup brickhouse-import-backup.json
```

The script rewrites the seed and checks its totals against the workbook's OVERVIEW sheet. The
`--backup` file can be loaded into a running installation through *Data Management → JSON Restore*.

### How the workbook maps to BRICKHOUSE

| Workbook | BRICKHOUSE |
|---|---|
| Registry ID (MAIN-01, APP-WEB-01, API-01, ECO-01, TPL-01, …) | Application `code`, unchanged (BRICKHOUSE IDs are APP-001 …) |
| Category (Main Applications, Learning & Experimental, …) | Application category |
| API-01 … API-12 | API records API-001 … API-012 (same number, same order, `code` = API-01 …) + an application of the same name that provides it, tagged with its core (Commerce / Operations / Rental Core) |
| Supporting UI repositories UI-01 … UI-05 | UI components of the matching API application that **consume** the API. They are never stored as the API repository |
| GitHub Repository / URL / Default Branch / Repository Role | Repository (+ `role` on the application→repository link) |
| Access Status | Repository `accessStatus` (accessible / inaccessible) |
| "Not provided" / "Not supplied" repositories | No repository record. The application description says the repository was not supplied |
| Git Activity rows | `core/git-commits.json` (recorded commits; prefix GC) |

**Not in the workbook, so set by default (please review):**
- Lifecycle: every application starts as `development`.
- Ownership: only name-evident projects are mapped (Orange LMS, Orange Kode Company Profile and
  Orange Scrolls → Orange Kode; Sadino Technology Company Profile → Sadino Technology;
  Sekolah Stack, Protein Shack and Cookiefy → their companies). All others are assigned to Orange
  Kode and tagged `owner-to-confirm`. Search for that tag in Applications.
- Repository visibility is `unknown`, language is empty, and API protocol/auth default to REST / None.

## Layout

```
core/        entity records (companies, applications, repositories, components, apis,
             endpoints, deployments, reviews)
catalog/     master catalogs (technologies, infrastructure) and option lists (categories)
relationships/  junction collections – the only place many-to-many links live
system/      activities, settings, schema-version, id-sequences
```

## Rules

- Every record has a stable `PREFIX-001` ID. A new record takes the lowest free number for its
  prefix, so IDs freed by a delete are reused and numbering has no gaps. API and Activity IDs are
  never reused (see `LOCKED_ID_PREFIXES`). `system/id-sequences.json` records the highest number
  issued per prefix.
- Entities never embed relationship arrays. Direct, single-valued foreign keys stay on the record:
  `applications.ownerId`, `components.applicationId`, `endpoints.apiId`,
  `deployments.componentId` (+ optional `repositoryId`, `infrastructureId`).
- A deployment's application is derived through its component and is not stored twice.
- Technology **version and role** live on the relationship record, never on the catalog entry.
- Lifecycle values are canonical lowercase: `planning, development, testing, active, maintenance, archived`.
- Schema v2 (current) added `commits` and `repositories.accessStatus`. Stored v1 data is migrated
  automatically, and existing records are kept.

## Relationship collections

| File | Prefix | Meaning |
|---|---|---|
| application-repositories.json | AR | Application uses repository (`role`) |
| application-components.json | ACU | Application uses a **shared** component owned by another application. A component's own parent is `components.applicationId`, so this file never duplicates it. |
| component-repositories.json | CR | Component source lives in repository (`path` optional) |
| component-technologies.json | CT | Component uses technology (`role`, `version`) |
| component-infrastructure.json | CI | Component uses infrastructure resource (`resourceName`) |
| component-services.json | CS | Component → component dependency (`relationshipType`: depends_on, calls, publishes_to, extends) |
| application-apis.json | AA | Application **provides** API (one provider per API) |
| api-consumers.json | AC | API **consumed by** application |
| component-deployments.json | CD | Additional component included in a deployment (e.g. a bundled shared library). The primary component is `deployments.componentId`. |

### Documented extensions

Added because the specification's wizards capture these links and they need a normalized home:

| File | Prefix | Why |
|---|---|---|
| component-apis.json | CA | "Component provides or consumes APIs" (`role`: provider / consumer) |
| api-infrastructure.json | PI | Infrastructure selected in the Add API & Service wizard |
| application-technologies.json | AT | Technology choices in Create Application → Technical Details (`role`, `version`) |
| application-infrastructure.json | AI | Infrastructure linked directly in Create Application → Relations |

Extra record fields beyond the spec's examples (e.g. `applications.architecture`,
`apis.serviceType`, `deployments.name`) hold values entered in the wizards.

## Recorded commits

`core/git-commits.json` holds commits that were actually retrieved (SHA, message, URL, UTC time).
They are a selected snapshot, not full history, and carry no author, branch or pull-request data.
Progress & Review shows them as **Recorded snapshot** and reports branches, PRs and contributors as
"not recorded". Commits belong to their repository: deleting a repository removes its commits
(the delete dialog says so). When no commits are recorded at all, the dashboards fall back to
clearly labelled sample data.

## Reviews

`core/reviews.json` (prefix `REV`) is reserved for optional progress/review snapshots. It is **not**
an approval workflow. Git commits, branches and pull requests belong to Progress & Review, which in
v1.0 shows clearly labelled sample data because no Git provider is connected.
