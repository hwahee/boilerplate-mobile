/**
 * `bun run db:seed` — development seed data. Idempotent: fixed UUIDs with
 * ON CONFLICT DO NOTHING, so re-running never duplicates rows.
 */
import { SQL } from 'bun';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required (copy .env.example to .env first).');
  process.exit(1);
}

const SEED_TODOS = [
  { id: '00000000-0000-4000-8000-000000000001', title: 'Read the README', status: 'done' },
  {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Explore the design system page',
    status: 'open',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    title: 'Toggle dark mode and design B',
    status: 'open',
  },
  {
    id: '00000000-0000-4000-8000-000000000004',
    title: 'Run the test suite (bun test)',
    status: 'open',
  },
  { id: '00000000-0000-4000-8000-000000000005', title: 'Ship something great', status: 'open' },
] as const;

// ── Mobile layer (migrations/0002_mobile.sql) ───────────────────────────────

/** Extra rows so the app's infinite scroll actually pages (limit defaults to 20). */
const SEED_MOBILE_TODOS = [
  { id: '00000000-0000-4000-8000-000000000006', title: 'Run the app (bun run dev:mobile)' },
  { id: '00000000-0000-4000-8000-000000000007', title: 'Scroll this list to page by cursor' },
  { id: '00000000-0000-4000-8000-000000000008', title: 'Try the offline banner (airplane mode)' },
  { id: '00000000-0000-4000-8000-000000000009', title: 'Check the boot ad slot demo' },
  { id: '00000000-0000-4000-8000-00000000000a', title: 'Switch design A ↔ B in Settings' },
  { id: '00000000-0000-4000-8000-00000000000b', title: 'Change the language in Settings' },
  { id: '00000000-0000-4000-8000-00000000000c', title: 'Register a push token (dry-run)' },
  { id: '00000000-0000-4000-8000-00000000000d', title: 'Read docs/platform-decisions.md' },
  { id: '00000000-0000-4000-8000-00000000000e', title: 'Inspect the 426 upgrade gate' },
  { id: '00000000-0000-4000-8000-00000000000f', title: 'Toggle maintenance via the admin API' },
] as const;

// Both platforms start fully supported at 1.0.0 — raise these via
// PUT /api/admin/version-policy/:platform (see docs/release-playbook.md).
const SEED_VERSION_POLICIES = [
  {
    platform: 'ios',
    min: '1.0.0',
    latest: '1.0.0',
    mode: 'store',
    storeUrl: 'https://apps.apple.com/app/id0000000000',
  },
  {
    platform: 'android',
    min: '1.0.0',
    latest: '1.0.0',
    mode: 'store',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.example.mobileboilerplate',
  },
] as const;

// Remote-config defaults (all well-known keys, see @shared/domain/app-config).
const SEED_APP_CONFIG: Record<string, unknown> = {
  maintenance: { enabled: false, message: null },
  noticeBanner: {
    enabled: true,
    text: 'Welcome! This banner is served by remote config.',
    url: null,
  },
  features: { infiniteScrollDemo: true },
  bootAd: { enabled: true, minShowMs: 1200, timeoutMs: 4000, skippable: true },
  configPolling: { intervalMs: 60000 },
};

const sql = new SQL(databaseUrl);
try {
  for (const todo of SEED_TODOS) {
    await sql`
      INSERT INTO todos (id, title, status)
      VALUES (${todo.id}, ${todo.title}, ${todo.status})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const todo of SEED_MOBILE_TODOS) {
    await sql`
      INSERT INTO todos (id, title, status)
      VALUES (${todo.id}, ${todo.title}, 'open')
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const policy of SEED_VERSION_POLICIES) {
    await sql`
      INSERT INTO version_policies
        (platform, min_supported_version, latest_version, update_mode, store_url)
      VALUES (${policy.platform}, ${policy.min}, ${policy.latest}, ${policy.mode}, ${policy.storeUrl})
      ON CONFLICT (platform) DO NOTHING
    `;
  }

  let configInserted = 0;
  for (const [key, value] of Object.entries(SEED_APP_CONFIG)) {
    const rows = await sql<{ key: string }[]>`
      INSERT INTO app_config (key, value)
      VALUES (${key}, ${JSON.stringify(value)}::jsonb)
      ON CONFLICT (key, COALESCE(platform, '*'), COALESCE(min_app_version, '*')) DO NOTHING
      RETURNING key
    `;
    configInserted += rows.length;
  }
  if (configInserted > 0) {
    await sql`UPDATE app_config_revision SET revision = revision + 1`;
  }

  const todoCount = SEED_TODOS.length + SEED_MOBILE_TODOS.length;
  console.log(
    `Seeded ${todoCount} todos, ${SEED_VERSION_POLICIES.length} version policies, ` +
      `${Object.keys(SEED_APP_CONFIG).length} config keys (existing rows untouched).`,
  );
} finally {
  await sql.close();
}
