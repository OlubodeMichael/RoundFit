/**
 * Lightweight unit-test runner for pure TypeScript logic (cache engine, date
 * helpers, aggregators). Deliberately NOT jest-expo: it does not touch the
 * Expo/Metro/Babel pipeline, so it can never affect the production build.
 * For native/React component tests, add jest-expo separately later.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Only pick up the isolated logic test suite. Keeps native/RN modules out.
  roots: ['<rootDir>/__tests__'],
  moduleNameMapper: {
    // In-memory AsyncStorage so cache modules exercise real read/write paths.
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  clearMocks: true,
};
