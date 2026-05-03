const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// IMPORTANT: do not add the entire workspaceRoot here.
// Vite (used by sibling web artifacts) constantly creates and deletes
// node_modules/.vite/deps_temp_* directories, which causes Metro's
// FallbackWatcher to crash with ENOENT. We only need to watch the libs
// the mobile app actually imports from PLUS the workspace's pnpm store
// (so Metro is allowed to resolve symlinked packages from .pnpm/).
// Vite's .vite cache lives inside artifact-local node_modules, not the
// workspace-root node_modules, so watching the root store is safe.
config.watchFolders = [
  path.resolve(workspaceRoot, "lib/api-client-react"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// pnpm uses symlinks; Metro must follow them or it cannot find packages
// that live in the .pnpm content-addressed store.
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

config.resolver.disableHierarchicalLookup = false;

module.exports = config;
