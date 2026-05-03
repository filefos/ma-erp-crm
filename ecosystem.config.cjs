// PM2 process file for the MA ERP-CRM API server.
// Run from project root: `pm2 start ecosystem.config.cjs --env production`
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "ma-erp-api",
      cwd: path.resolve(__dirname, "artifacts/api-server"),
      script: "dist/index.mjs",
      node_args: "--enable-source-maps",
      instances: 1,            // bump to "max" for cluster mode once stable
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      kill_timeout: 5000,
      env_file: path.resolve(__dirname, ".env.production"),
      env_production: {
        NODE_ENV: "production",
      },
      out_file: "/home/deploy/.pm2/logs/ma-erp-api-out.log",
      error_file: "/home/deploy/.pm2/logs/ma-erp-api-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
