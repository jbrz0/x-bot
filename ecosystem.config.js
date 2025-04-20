module.exports = {
  apps : [{
    name   : "x-bot",
    script : "./dist/scheduler.js", // Path to the compiled scheduler entry point
    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    // args   : "one two", // Arguments passed via process.argv
    instances: 1, // Run a single instance
    autorestart: true, // Automatically restart if the app crashes
    watch: false, // Do not watch for file changes (rely on Docker rebuilds/restarts)
    max_memory_restart: '256M', // Restart if it exceeds 256MB memory
    // Specify Node.js interpreter arguments if needed
    // node_args: "--harmony",
    // Environment variables specific to this app (can also be set via .env or Docker)
    env: {
      NODE_ENV: "production",
      // We will rely on .env file loaded via docker-compose for other variables
    },
    // Log configuration (PM2 handles log rotation)
    log_date_format: "YYYY-MM-DD HH:mm:ss Z", // Add timezone info
    out_file: "/dev/null", // Redirect stdout to null (we want logs from Pino)
    error_file: "/dev/null", // Redirect stderr to null (Pino logs errors to stdout)
    combine_logs: true, // Combine stdout and stderr streams for Pino
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