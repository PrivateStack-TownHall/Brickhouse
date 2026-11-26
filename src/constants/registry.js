// Canonical registry domain constants, option lists, and static guide metadata.

export const DAY_MS = 86400000;
export const VIEW_STORAGE_PREFIX = 'brickhouse.view.';
export const DEFAULT_LIGHTHOUSE_URL = 'http://localhost:5174';

export const ACCESS_STATUS_LABELS = {
  accessible: 'Accessible',
  inaccessible: 'Inaccessible (404)',
  unknown: 'Not checked',
};

export const REPOSITORY_ROLES = [
  'Frontend',
  'Backend',
  'Full Stack',
  'Mobile',
  'Monorepo',
  'Shared Library',
  'Infrastructure',
  'Documentation',
  'Website',
];

export const REPOSITORY_LANGUAGES = [
  'JavaScript',
  'TypeScript',
  'PHP',
  'Go',
  'Python',
  'Dart',
  'Java',
  'Kotlin',
  'Swift',
  'C#',
  'Ruby',
  'Rust',
  'HCL',
  'Other',
];

export const BRANCH_KINDS = ['main', 'develop', 'feature', 'fix', 'release', 'chore'];

export const ENVIRONMENT_GUIDE = {
  development: 'Lingkungan lokal developer untuk coding, eksperimen, dan debugging awal.',
  preview: 'Lingkungan pratinjau sementara (per branch / PR) untuk mengecek hasil build.',
  staging: 'Lingkungan uji coba pra-rilis mirip production untuk QA dan UAT.',
  production: 'Lingkungan live utama yang diakses langsung oleh pengguna akhir.',
};

// Step 02 technology roles → catalog categories offered for each (disjoint so each tech appears in one card).
export const APPLICATION_TECH_ROLES = [
  { key: 'techLanguage', role: 'Programming Language', label: 'Programming Language', categories: ['Programming Language'] },
  { key: 'techFrontend', role: 'Frontend Technology', label: 'Frontend Technology', categories: ['Frontend Framework', 'Styling', 'Library'] },
  { key: 'techBackend', role: 'Backend Technology', label: 'Backend Technology', categories: ['Backend Framework', 'Runtime'] },
  { key: 'techDatabase', role: 'Database', label: 'Database', categories: ['Database'] },
  { key: 'techOrm', role: 'ORM / Data Access', label: 'ORM / Data Access', categories: ['ORM'] },
  { key: 'techTesting', role: 'Testings', label: 'Testings', categories: ['Testing'] },
  { key: 'techTools', role: 'Additional Tools', label: 'Additional Tools', categories: ['DevOps', 'Other'] },
];

export const TECH_GROUPS = {
  frameworks: { label: 'Frameworks', categories: ['Frontend Framework', 'Backend Framework'] },
  libraries: { label: 'Libraries', categories: ['Library', 'ORM', 'Styling'] },
  tools: { label: 'Tools', categories: ['DevOps', 'Testing'] },
  platforms: { label: 'Platforms', categories: ['Programming Language', 'Runtime', 'Other'] },
  databases: { label: 'Databases', categories: ['Database'] },
};

export const INFRASTRUCTURE_GROUPS = {
  compute: { label: 'Compute', categories: ['Compute', 'Hosting'], hint: 'Compute & hosting' },
  database: { label: 'Database', categories: ['Database'] },
  storage: { label: 'Storage', categories: ['Storage'] },
  network: { label: 'Network', categories: ['Network', 'CDN'], hint: 'Network & CDN' },
  security: { label: 'Security', categories: ['Security'] },
};

export const COMPONENT_GUIDE = [
  {
    title: 'Component Category',
    subtitle: 'Cakupan & kepemilikan komponen',
    items: [
      ['Application Module', 'Modul khusus yang hanya dipakai oleh 1 aplikasi utama.'],
      ['Shared Module', 'Modul bersama yang dipakai ulang oleh beberapa aplikasi.'],
      ['Integration', 'Penghubung ke sistem luar / pihak ketiga (API, Payment, Email).'],
      ['Platform', 'Fondasi inti yang menopang banyak layanan (Auth Server, Gateway).'],
    ],
  },
  {
    title: 'Component Role',
    subtitle: 'Peran fungsional di dalam sistem',
    items: [
      ['Feature', 'Fitur bisnis utama yang dipakai langsung oleh user (Order, LMS, Chat).'],
      ['Core', 'Bagian vital agar aplikasi bisa berjalan (Login, Routing, State utama).'],
      ['Utility', 'Alat bantu pendukung teknis (Format tanggal, Export PDF, Helper).'],
      ['Gateway', 'Pintu gerbang pengatur lalu lintas request masuk/keluar antar layanan.'],
    ],
  },
  {
    title: 'Component Type',
    subtitle: 'Bentuk teknis komponennya',
    items: [
      ['Module', 'Bagian fungsional terstruktur di dalam satu codebase aplikasi.'],
      ['Service', 'Layanan mandiri (Backend API, Microservice, atau Background Worker).'],
      ['Library', 'Kumpulan fungsi/kode (package/SDK) yang di-import oleh proyek lain.'],
      ['UI', 'Tampilan antarmuka visual (halaman, form, widget frontend).'],
    ],
  },
];

export const BERRY_FRESH_COMPONENTS = [
  { name: 'Storefront Catalog & Cart', category: 'Application Module', role: 'Feature', type: 'UI', layer: 'Frontend', desc: 'Halaman katalog buah, filter harga, dan keranjang belanja user.' },
  { name: 'Auth & User Session', category: 'Platform', role: 'Core', type: 'Service', layer: 'Backend', desc: 'Layanan login, registrasi, dan validasi JWT token seluruh aplikasi.' },
  { name: 'Midtrans Payment Adapter', category: 'Integration', role: 'Gateway', type: 'Service', layer: 'Backend', desc: 'Penghubung pembayaran QRIS/VA & webhook ke layanan Midtrans.' },
  { name: 'Berry UI Kit', category: 'Shared Module', role: 'Utility', type: 'Library', layer: 'Shared', desc: 'Komponen tombol, card & format harga Rupiah yang dipakai ulang.' },
];
