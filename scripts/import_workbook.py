#!/usr/bin/env python3
"""
Import the VSG GitHub Repository Registry workbook into BRICKHOUSE seed JSON.

    pip install openpyxl
    python3 scripts/import_workbook.py <workbook.xlsx> [--backup out.json]

Writes database/core, database/relationships, database/catalog/infrastructure.json,
database/catalog/categories.json, database/system/*.json. The technology catalog
(database/catalog/technologies.json) is kept as it is.

With --backup it also writes a BRICKHOUSE backup file that can be loaded into an
existing installation via Data Management → JSON Restore.

Mapping decisions (see database/README.md):
- Every registry project becomes an Application. The workbook ID (MAIN-01, APP-WEB-01,
  API-01, ECO-01, …) is kept unchanged as the application `code`.
- API-01 … API-12 become API records API-001 … API-012 (same numbers, same order) and keep
  their workbook ID as `code`. Each API also gets an application of the same name in the
  "API Portfolio" category that provides it.
- Supporting UI repositories (UI-01 … UI-05) are UI components of the matching API
  application that consume the API. They are never treated as the API repository.
- Repositories marked "Not provided" / "Not supplied" are not created.
- Ownership: only name-evident projects are mapped to a company; every other project is
  assigned to DEFAULT_OWNER and tagged `owner-to-confirm`.
- The workbook has no lifecycle per project, so all applications start as DEFAULT_LIFECYCLE.
- Git Activity rows become recorded commits (a selected sample, not full history).
"""
import argparse
import datetime as dt
import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / 'database'
SCHEMA_VERSION = 2
APP_VERSION = '1.0.0'

COMPANIES = [
    ('COMP-001', 'OK', 'Orange Kode'),
    ('COMP-002', 'ST', 'Sadino Technology'),
    ('COMP-003', 'SS', 'Sekolah Stack'),
    ('COMP-004', 'PS', 'Protein Shack'),
    ('COMP-005', 'CK', 'Cookiefy'),
]
# Ownership that is evident from the project name. Everything else → DEFAULT_OWNER + tag.
OWNER_BY_CODE = {
    'MAIN-03': 'COMP-001',  # Orange LMS
    'MAIN-05': 'COMP-001',  # Orange Kode Company Profile
    'MAIN-06': 'COMP-001',  # Orange Scrolls
    'MAIN-07': 'COMP-002',  # Sadino Technology Company Profile
    'MAIN-08': 'COMP-003',  # Sekolah Stack
    'MAIN-09': 'COMP-004',  # Protein Shack
    'MAIN-10': 'COMP-005',  # Cookiefy
}
DEFAULT_OWNER = 'COMP-001'
DEFAULT_LIFECYCLE = 'development'
OWNER_TAG = 'owner-to-confirm'

MISSING = ('not provided', 'not supplied', '—', '-', '')

# Workbook "Repository Role" → BRICKHOUSE repository type
REPO_TYPE = {
    'application': 'application', 'application ui': 'frontend', 'content repository': 'content',
    'application / cms': 'application', 'web application': 'application', 'web application / admin ui': 'application',
    'mobile application': 'mobile', 'mobile / experimental': 'mobile', 'api': 'backend', 'frontend ui': 'frontend',
    'ecosystem platform': 'application', 'core infrastructure': 'infrastructure', 'asset management': 'application',
    'dashboard toolkit': 'library', 'experimental / sandbox': 'application', 'api template': 'template',
    'backend template': 'template', 'learning resource': 'learning-resource', 'developer tool': 'tool',
}
# Application type from catalog platform or repository role
def app_type(platform, role, category):
    if category == 'API Portfolio':
        return 'API Platform'
    p = (platform or '').lower()
    if p.startswith('mobile'):
        return 'Mobile Application'
    if p == 'web':
        return 'Web Application'
    if p == 'tbd':
        return 'Unspecified'
    by_role = {
        'ecosystem platform': 'Ecosystem Platform', 'core infrastructure': 'Core Infrastructure',
        'asset management': 'Asset Management', 'dashboard toolkit': 'Dashboard Toolkit',
        'experimental / sandbox': 'Experimental / Sandbox', 'api template': 'Template', 'backend template': 'Template',
        'learning resource': 'Learning Resource', 'developer tool': 'Developer Tool',
    }
    return by_role.get((role or '').lower(), 'Unspecified')


def blank(v):
    t = '' if v is None else str(v).strip().lower()
    return t in MISSING or t.startswith('not provided') or t.startswith('not supplied')


def clean(v):
    return '' if blank(v) else str(v).strip()


def rows(ws, header_row=1):
    it = ws.iter_rows(min_row=header_row, values_only=True)
    header = [str(h).strip() if h is not None else None for h in next(it)]
    for r in it:
        rec = {h: v for h, v in zip(header, r) if h}
        if any(v is not None for v in rec.values()):
            yield rec


def find_header_row(ws, first_col_name):
    for i, r in enumerate(ws.iter_rows(values_only=True), start=1):
        if r and r[0] == first_col_name:
            return i
    raise SystemExit(f'Header "{first_col_name}" not found in sheet {ws.title}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('workbook')
    ap.add_argument('--backup', help='also write a BRICKHOUSE backup JSON to this path')
    args = ap.parse_args()
    src = Path(args.workbook)
    wb = openpyxl.load_workbook(src, data_only=True)
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    seq = {}

    def next_id(prefix):
        seq[prefix] = seq.get(prefix, 0) + 1
        return f'{prefix}-{seq[prefix]:03d}'

    registry = list(rows(wb['REPOSITORY REGISTRY']))
    catalog = {r['App ID']: r for r in rows(wb['APPLICATION CATALOG']) if r.get('App ID')}
    api_rows = [r for r in rows(wb['API PORTFOLIO']) if r.get('API ID')]

    # ---------- projects (one application per registry ID; API-xx handled with the API portfolio) ----------
    projects = {}
    for r in registry:
        rid = clean(r['Registry ID'])
        if not rid:
            continue
        projects.setdefault(rid, {'id': rid, 'name': clean(r['Project']), 'category': clean(r['Category']), 'rows': []})['rows'].append(r)

    applications, repositories, components, apis = [], [], [], []
    rel = {k: [] for k in ['application-repositories', 'application-components', 'component-repositories', 'component-technologies',
                           'component-infrastructure', 'component-services', 'application-apis', 'api-consumers',
                           'component-deployments', 'component-apis', 'api-infrastructure', 'application-technologies',
                           'application-infrastructure']}
    rel_prefix = {'application-repositories': 'AR', 'component-repositories': 'CR', 'application-apis': 'AA',
                  'component-apis': 'CA', 'application-infrastructure': 'AI'}
    repo_by_full = {}
    app_by_code = {}
    owners_assumed = []

    # Source-control "infrastructure": one GitHub organization record per repository owner.
    infrastructure = []
    infra_by_org = {}

    def org_infra(org):
        if org not in infra_by_org:
            iid = next_id('INF')
            infrastructure.append({
                'id': iid, 'name': f'GitHub – {org}', 'provider': 'GitHub', 'category': 'Other',
                'resourceType': 'Source Control Organization', 'region': '', 'dashboardUrl': f'https://github.com/{org}',
                'description': f'GitHub owner of registered repositories ({org}).', 'status': 'active', 'createdAt': now, 'updatedAt': now,
            })
            infra_by_org[org] = iid
        return infra_by_org[org]

    def link(kind, **fields):
        rel[kind].append({'id': next_id(rel_prefix[kind]), **fields})

    def make_repo(r):
        full = clean(r['GitHub Repository'])
        if not full or '/' not in full:
            return None
        if full in repo_by_full:
            return repo_by_full[full]
        org, name = full.split('/', 1)
        access = clean(r['Access Status']).lower()
        rid = next_id('REPO')
        role = clean(r['Repository Role'])
        repositories.append({
            'id': rid, 'name': name, 'code': name.lower(), 'provider': 'GitHub', 'organization': org,
            'url': clean(r['GitHub URL']), 'type': REPO_TYPE.get(role.lower(), 'application'),
            'mainBranch': clean(r['Default Branch']), 'language': '', 'visibility': 'unknown',
            'accessStatus': 'accessible' if access == 'accessible' else 'inaccessible' if 'inaccessible' in access or '404' in access else 'unknown',
            'description': clean(r.get('Notes')), 'topics': [], 'createdAt': now, 'updatedAt': now,
        })
        repo_by_full[full] = rid
        return rid

    def make_app(code, name, category, app_type_, platform, description, tags=()):
        owner = OWNER_BY_CODE.get(code)
        tags = list(tags)
        if not owner:
            owner = DEFAULT_OWNER
            tags.append(OWNER_TAG)
            owners_assumed.append(code)
        aid = next_id('APP')
        applications.append({
            'id': aid, 'name': name, 'code': code, 'description': description, 'purpose': '',
            'ownerId': owner, 'category': category, 'type': app_type_, 'lifecycle': DEFAULT_LIFECYCLE,
            'websiteUrl': '', 'documentationUrl': '', 'tags': tags,
            'architecture': '', 'platform': platform, 'hosting': '', 'environments': [],
            'createdAt': now, 'updatedAt': now,
        })
        app_by_code[code] = aid
        return aid

    def link_repo(aid, repo_id, role):
        link('application-repositories', applicationId=aid, repositoryId=repo_id, role=role)
        org = next(r for r in repositories if r['id'] == repo_id)['organization']
        inf = org_infra(org)
        if not any(l['applicationId'] == aid and l['infrastructureId'] == inf for l in rel['application-infrastructure']):
            link('application-infrastructure', applicationId=aid, infrastructureId=inf, role='Source control (GitHub)')

    # Order: Main, Learning & Experimental, (API portfolio), Infrastructure & Ecosystem, Templates & Developer Tools
    order = ['Main Applications', 'Learning & Experimental', 'API Portfolio', 'Infrastructure & Ecosystem', 'Templates & Developer Tools']
    ui_rows = [p for p in projects.values() if p['category'] == 'Supporting UI Repositories']
    api_by_code = {}

    for cat in order:
        if cat == 'API Portfolio':
            for a in api_rows:
                code = clean(a['API ID'])
                core = clean(a['Core'])
                reg = projects.get(code)
                api_repo_row = reg['rows'][0] if reg else None
                has_repo = api_repo_row is not None and not blank(api_repo_row['GitHub Repository'])
                note = clean(a.get('Notes'))
                parts = [f'API portfolio project · {core}', note, '' if has_repo else 'API repository not provided in this batch']
                desc = ' · '.join(x for x in parts if x)
                aid = make_app(code, clean(a['API Name']), 'API Portfolio', 'API Platform', 'API', desc, tags=[core])
                num = int(re.sub(r'\D', '', code))
                api_id = f'API-{num:03d}'
                seq['API'] = max(seq.get('API', 0), num)
                apis.append({
                    'id': api_id, 'name': f"{clean(a['API Name'])} API", 'code': code, 'version': '', 'baseUrl': '',
                    'protocol': 'REST', 'authentication': 'None', 'serviceType': 'API Service', 'exposure': 'internal',
                    'environment': '', 'documentationUrl': '', 'description': ' · '.join(x for x in [core, note] if x), 'tags': [core],
                    'lifecycle': DEFAULT_LIFECYCLE, 'createdAt': now, 'updatedAt': now,
                })
                api_by_code[code] = (api_id, aid)
                link('application-apis', applicationId=aid, apiId=api_id, role='provider')
                if has_repo:
                    rid = make_repo(api_repo_row)
                    link_repo(aid, rid, 'API')
                    cid = next_id('CMP')
                    components.append({
                        'id': cid, 'applicationId': aid, 'name': f"{clean(a['API Name'])} API", 'code': next(x['name'] for x in repositories if x['id'] == rid),
                        'category': 'Application Module', 'role': 'Core', 'type': 'Service', 'layer': 'Backend', 'version': '',
                        'description': 'API service implementation.', 'capabilities': [], 'lifecycle': DEFAULT_LIFECYCLE,
                        'createdAt': now, 'updatedAt': now,
                    })
                    link('component-repositories', componentId=cid, repositoryId=rid, path='')
                    link('component-apis', componentId=cid, apiId=api_id, role='provider')
            continue
        for p in [p for p in projects.values() if p['category'] == cat]:
            code = p['id']
            cat_row = catalog.get(code, {})
            first = p['rows'][0]
            notes = [clean(r.get('Notes')) for r in p['rows']] + [clean(cat_row.get('Notes'))]
            notes = list(dict.fromkeys(n for n in notes if n))
            repo_rows = [r for r in p['rows'] if not blank(r['GitHub Repository'])]
            if not repo_rows and not any('not supplied' in n.lower() or 'not provided' in n.lower() for n in notes):
                notes.append('Repository not supplied in the registry workbook')
            aid = make_app(code, p['name'], cat, app_type(cat_row.get('Platform'), clean(first['Repository Role']), cat),
                           clean(cat_row.get('Platform')) if clean(cat_row.get('Platform')).upper() != 'TBD' else '', ' · '.join(notes))
            for r in repo_rows:
                link_repo(aid, make_repo(r), clean(r['Repository Role']))

    # ---------- supporting UI repositories → UI components of the API application ----------
    for p in ui_rows:
        r = p['rows'][0]
        m = re.search(r'API-\d+', clean(r.get('Notes')) or '')
        api_code = m.group(0) if m else None
        if not api_code:  # WareTrack note has no API id – match through API PORTFOLIO "Separate UI Repository"
            short = clean(r['GitHub Repository']).split('/')[-1].lower()
            for a in api_rows:
                ui = clean(a.get('Separate UI Repository')).lower()
                if ui and (ui == short or ui.startswith(short) or short in ui.split(' ')[0]):
                    api_code = clean(a['API ID'])
        if api_code not in api_by_code:
            sys.exit(f'Could not match UI repository {p["id"]} to an API')
        api_id, aid = api_by_code[api_code]
        rid = make_repo(r)
        link_repo(aid, rid, f"Frontend UI ({p['id']}, separate repository)")
        cid = next_id('CMP')
        components.append({
            'id': cid, 'applicationId': aid, 'name': p['name'], 'code': p['id'], 'category': 'Application Module', 'role': 'Feature',
            'type': 'UI', 'layer': 'Frontend', 'version': '', 'description': clean(r.get('Notes')) or 'Supporting UI repository.',
            'capabilities': [], 'lifecycle': DEFAULT_LIFECYCLE, 'createdAt': now, 'updatedAt': now,
        })
        link('component-repositories', componentId=cid, repositoryId=rid, path='')
        link('component-apis', componentId=cid, apiId=api_id, role='consumer')

    # ---------- recorded commits ----------
    ws = wb['GIT ACTIVITY']
    hdr = find_header_row(ws, 'Repository')
    commits = []
    for r in ws.iter_rows(min_row=hdr + 1, values_only=True):
        full, when, msg, sha, url = (r + (None,) * 5)[:5]
        if not full or not sha or not isinstance(when, dt.datetime):
            continue
        rid = repo_by_full.get(str(full).strip())
        if not rid:
            sys.exit(f'Commit {sha} refers to unknown repository {full}')
        commits.append({
            'id': None, 'repositoryId': rid, 'sha': str(sha).strip(), 'message': clean(msg), 'url': clean(url),
            'committedAt': when.replace(tzinfo=dt.timezone.utc).isoformat().replace('+00:00', 'Z'),
            'author': None, 'source': f'GitHub snapshot ({src.name})', 'createdAt': now,
        })
    commits.sort(key=lambda c: c['committedAt'])
    for c in commits:
        c['id'] = next_id('GC')

    # ---------- checks against the workbook's own totals ----------
    names = [r['name'].lower() for r in repositories]
    assert len(names) == len(set(names)), 'duplicate repository names'
    codes = [a['code'] for a in applications]
    assert len(codes) == len(set(codes)), 'duplicate application codes'
    ov = wb['OVERVIEW']
    expected_total, expected_ok = ov['C8'].value, ov['G8'].value
    got_ok = sum(1 for r in repositories if r['accessStatus'] == 'accessible')
    if (expected_total, expected_ok) != (len(repositories), got_ok):
        sys.exit(f'Repository totals differ from workbook overview: {(len(repositories), got_ok)} vs {(expected_total, expected_ok)}')

    # ---------- write ----------
    def write(rel_path, data):
        path = DB / rel_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n')

    companies = [{'id': i, 'code': c, 'name': n, 'description': '', 'websiteUrl': '', 'createdAt': now, 'updatedAt': now} for i, c, n in COMPANIES]
    seq['COMP'] = len(companies)
    collections = {
        'core/companies.json': companies, 'core/applications.json': applications, 'core/repositories.json': repositories,
        'core/components.json': components, 'core/apis.json': sorted(apis, key=lambda a: a['id']), 'core/endpoints.json': [],
        'core/deployments.json': [], 'core/reviews.json': [], 'core/git-commits.json': commits,
        'catalog/infrastructure.json': infrastructure,
    }
    for k, v in rel.items():
        collections[f'relationships/{k}.json'] = v

    categories = json.loads((DB / 'catalog/categories.json').read_text())
    categories['applicationCategories'] = list(order)
    categories['applicationTypes'] = ['Web Application', 'Mobile Application', 'API Platform', 'Ecosystem Platform', 'Core Infrastructure',
                                      'Asset Management', 'Dashboard Toolkit', 'Experimental / Sandbox', 'Template', 'Learning Resource',
                                      'Developer Tool', 'Unspecified']
    categories['repositoryTypes'] = ['application', 'frontend', 'backend', 'fullstack', 'mobile', 'library', 'content', 'template',
                                     'learning-resource', 'tool', 'monorepo', 'infrastructure', 'documentation']
    collections['catalog/categories.json'] = categories

    activities = [{
        'id': next_id('ACT'), 'timestamp': now, 'actor': 'Registry Owner', 'category': 'system', 'action': 'Workbook imported',
        'resourceType': 'System', 'resourceId': None, 'applicationId': None,
        'description': (f'Imported {src.name}: {len(applications)} applications, {len(repositories)} repositories, '
                        f'{len(apis)} APIs, {len(components)} components, {len(commits)} recorded commits.'),
    }]
    collections['system/activities.json'] = activities
    settings = json.loads((DB / 'system/settings.json').read_text())
    settings['integrations']['github']['organization'] = 'PrivateStack-TownHall'
    settings['integrations']['github']['notes'] = 'Repositories also live under vincent-guizot. Not connected: Git data is a recorded snapshot.'
    collections['system/settings.json'] = settings
    collections['system/schema-version.json'] = {'version': SCHEMA_VERSION, 'name': 'brickhouse-registry',
                                                 'description': 'v2: recorded Git commits and repository access status', 'releasedAt': now[:10]}

    # sequences: max of everything already issued (relationships included)
    for path, rows_ in collections.items():
        if isinstance(rows_, list):
            for r in rows_:
                m = re.match(r'^([A-Z]+)-(\d+)$', str(r.get('id', '')))
                if m:
                    seq[m.group(1)] = max(seq.get(m.group(1), 0), int(m.group(2)))
    techs = json.loads((DB / 'catalog/technologies.json').read_text())
    seq['TECH'] = max(int(t['id'].split('-')[1]) for t in techs) if techs else 0
    for p in ['CMP', 'DEP', 'END', 'REV', 'ACU', 'CT', 'CI', 'CS', 'AC', 'CD', 'PI', 'AT']:
        seq.setdefault(p, 0)
    collections['system/id-sequences.json'] = dict(sorted(seq.items()))

    for path, data in collections.items():
        write(path, data)

    print(f'applications {len(applications)} | repositories {len(repositories)} ({got_ok} accessible) | APIs {len(apis)} | '
          f'components {len(components)} | commits {len(commits)} | infrastructure {len(infrastructure)}')
    print('ownership assumed (tagged owner-to-confirm):', ', '.join(owners_assumed))

    if args.backup:
        key = {
            'companies': 'core/companies.json', 'applications': 'core/applications.json', 'repositories': 'core/repositories.json',
            'components': 'core/components.json', 'apis': 'core/apis.json', 'endpoints': 'core/endpoints.json',
            'deployments': 'core/deployments.json', 'reviews': 'core/reviews.json', 'commits': 'core/git-commits.json',
            'technologies': None, 'infrastructure': 'catalog/infrastructure.json', 'activities': 'system/activities.json',
        }
        camel = lambda s: re.sub(r'-([a-z])', lambda m: m.group(1).upper(), s)
        data = {'schemaVersion': SCHEMA_VERSION}
        for k, path in key.items():
            data[k] = techs if k == 'technologies' else collections[path]
        for k in rel:
            data[camel(k)] = rel[k]
        data.update({'categories': categories, 'settings': settings, 'idSequences': collections['system/id-sequences.json'],
                     'meta': {'source': f'import:{src.name}', 'initializedAt': now, 'lastBackupAt': None, 'lastRestoreAt': None}})
        counts = {k: len(v) for k, v in data.items() if isinstance(v, list)}
        backup = {'format': 'brickhouse-backup', 'appVersion': APP_VERSION, 'schemaVersion': SCHEMA_VERSION, 'exportedAt': now,
                  'organization': 'VSG Group', 'counts': counts, 'data': data}
        Path(args.backup).write_text(json.dumps(backup, indent=2, ensure_ascii=False) + '\n')
        print('backup written to', args.backup)


if __name__ == '__main__':
    main()
