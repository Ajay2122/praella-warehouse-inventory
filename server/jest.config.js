/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupAfterEnv.ts'],
  globalSetup: '<rootDir>/tests/globalSetup.ts',
  testTimeout: 20000,
  // Tests share one disposable Postgres test DB rather than each getting
  // its own transaction-isolated sandbox - simplest correct option at this
  // scope, but it means tests must run serially, not in parallel workers.
  maxWorkers: 1,
};
