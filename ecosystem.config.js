module.exports = {
  apps : [{
    name   : "x-bot",
    script : "src/scheduler.ts",
    interpreter: "./node_modules/.bin/ts-node",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: "production",
      TS_NODE_TRANSPILE_ONLY: "true",
      TS_NODE_FILES: "true"
    },
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    out_file: "./logs/out.log",
    error_file: "./logs/error.log",
    combine_logs: true,
  }]

  // Deploy configuration example (optional, for deploying via PM2 directly)
  // deploy : {
  //   production : {
  //     user : 'SSH_USERNAME',
  //     host : 'SSH_HOSTMACHINE',
  //     ref  : 'origin/main',
  //     repo : 'GIT_REPOSITORY',
  //     path : 'DESTINATION_PATH',
  //     'pre-deploy-local': '',
  //     'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
  //     'pre-setup': ''
  //   }
  // }
}; 