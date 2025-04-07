module.exports = {
    apps: [
      {
        name: 'aiZoroBot-main',
        script: './main.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production',
          PM2: true
        },
        env_file: '.env'
      },
      {
        name: 'aiZoroBot-invite',
        script: './invite.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '1G',
        env: {
          NODE_ENV: 'production',
          PM2: true
        },
        env_file: '.env'
      }
    ]
  };
