// Polyfill Array.prototype.toReversed for Node 18 compatibility (EAS Build)
if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() { return [...this].reverse(); };
}

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  path.resolve(workspaceRoot, "lib/api-client-react"),
];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.extraNodeModules = {
  "@workspace/api-client-react": path.resolve(workspaceRoot, "lib/api-client-react"),
};

config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
