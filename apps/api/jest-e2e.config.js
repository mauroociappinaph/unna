module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@unna/domain$': '<rootDir>/../../packages/domain/src/index.ts',
    '^@unna/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup-e2e.ts'],
  testTimeout: 30000,
};