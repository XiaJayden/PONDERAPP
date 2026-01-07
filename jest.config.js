module.exports = {
    preset: 'jest-expo',
    // Explicitly set root directory to prevent looking for package.json in parent folder
    rootDir: '.',
    transformIgnorePatterns: [
      'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind)',
    ],
    setupFilesAfterEnv: [
      '@testing-library/jest-native/extend-expect',
      '<rootDir>/jest-setup.js',
    ],
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/$1',
    },
    collectCoverageFrom: [
      'app/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
      '!**/*.d.ts',
      '!**/node_modules/**',
    ],
    testMatch: [
      '**/__tests__/**/*.{ts,tsx}',
      '**/*.{spec,test}.{ts,tsx}',
    ],
  };