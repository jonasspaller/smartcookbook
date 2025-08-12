module.exports = {
  apps: [{
    name: 'smart-cookbook-api',
    script: 'src/index.js',
    watch: false, // 'watch' ist für die Produktion nicht empfohlen
    env: {
      NODE_ENV: 'production',
    },
    // --- Der entscheidende Teil ---
    // Weist pm2 an, den Prozess als 'www-data' zu starten.
    user: 'www-data',
    group: 'www-data',
  }]
};