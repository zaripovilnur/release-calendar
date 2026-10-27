// Визуальные тесты (раздел 12 ТЗ). Сервис поднимается на отдельной базе, рабочие данные не трогаются
const { defineConfig } = require('@playwright/test');

const PORT = 3100;
const env = {
  PORT: String(PORT),
  DB_FILE: './storage/test/app.db',
  UPLOAD_DIR: './storage/test/uploads',
  ADMIN_LOGIN: 'admin',
  ADMIN_PASSWORD: 'admin',
  SESSION_SECRET: 'visual-tests',
};

module.exports = defineConfig({
  testDir: './tests',
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  timeout: 60_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
  },
  webServer: {
    command: 'node server/seed.js && node server/seed.js --demo && node server/index.js',
    url: `http://localhost:${PORT}/api/state`,
    env,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
