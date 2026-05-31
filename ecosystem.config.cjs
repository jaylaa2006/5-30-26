module.exports = {
  apps: [{
    name: 'perankh',
    script: 'server.js',
    cwd: '/var/www/perankh',
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3456
    }
  }, {
    name: 'seba-api',
    script: 'seba-story-api.mjs',
    cwd: '/var/www/perankh',
    interpreter: 'node',
    interpreter_args: '--experimental-vm-modules',
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      SEBA_PORT: 3847
    }
  }, {
    name: 'senebty-photo-cleanup',
    script: 'scripts/senebty-photo-cleanup.mjs',
    cwd: '/var/www/perankh',
    interpreter: 'node',
    cron_restart: '0 3 * * *',
    autorestart: false,
    instances: 1,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
