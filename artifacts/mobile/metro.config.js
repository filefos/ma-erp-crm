const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// IMPORTANT: do not add the entire workspaceRoot here.
// Vite (used by sibling web artifacts) constantly creates and deletes
// node_modules/.vite/deps_temp_* directories, which causes Metro's
// FallbackWatcher to crash with ENOENT. We only need to watch the libs
// the mobile app actually imports from.
config.watchFolders = [
  path.resolve(workspaceRoot, "lib/api-client-react"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = false;

module.exports = config;
