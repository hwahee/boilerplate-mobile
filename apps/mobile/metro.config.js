/**
 * Metro config for the app living inside the fullstack boilerplate repo.
 *
 * Two things differ from a standalone Expo project:
 *
 * 1. `@shared/*` resolves to `<repo>/src/shared` — the SAME sources the Bun
 *    server imports (raw TypeScript; Metro compiles them like app code).
 *    The alias mirrors the `paths` entry in tsconfig.json.
 * 2. Dependencies are installed through Bun workspaces and may be hoisted to
 *    the repo root, so the app root and the repo root are both module roots.
 *
 * The web client and the app pin different React versions (Expo pins its
 * own); Bun's isolated install gives each package its own peer links, so the
 * app and everything it imports resolve to the app's React. Do NOT set
 * `disableHierarchicalLookup` — that layout depends on hierarchical lookup,
 * and turning it off breaks transitive resolution (e.g. expo-modules-core).
 *
 * Verify a change here with: `bunx expo export --platform android`.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(workspaceRoot, 'src/shared');

const config = getDefaultConfig(projectRoot);

// Watch the whole repo so edits in src/shared hot-reload the app.
config.watchFolders = [workspaceRoot];

// Resolve modules from the app first, then from the hoisted root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const SHARED_PREFIX = '@shared/';
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest || context.resolveRequest;
  if (moduleName.startsWith(SHARED_PREFIX)) {
    return resolve(
      context,
      path.join(sharedRoot, moduleName.slice(SHARED_PREFIX.length)),
      platform,
    );
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
