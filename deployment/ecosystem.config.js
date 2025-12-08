module.exports = {
  apps: [
    {
      name: 'chat-app-backend',
      cwd: '/var/www/chat-app/packages/backend',
      script: 'dist/src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '/var/www/chat-app/logs/backend-error.log',
      out_file: '/var/www/chat-app/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
    },
  ],
};
