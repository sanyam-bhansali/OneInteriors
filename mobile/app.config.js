const { existsSync } = require('fs');

/**
 * app.json, plus Firebase phone sign-in when its files are there (owner,
 * 4 Nov 2026).
 *
 * Firebase sends the SMS sign-in code. Its native setup needs the project's
 * google-services.json (Android) and GoogleService-Info.plist (iOS). They are
 * not in git: on EAS they come in as file environment variables
 * (GOOGLE_SERVICES_JSON, GOOGLE_SERVICE_INFO_PLIST); locally they can sit in
 * this folder. Without them the build is exactly as before and sign-in uses
 * the older code path (src/lib/phone-code.ts decides at run time).
 */
module.exports = ({ config }) => {
  const android = process.env.GOOGLE_SERVICES_JSON ?? (existsSync('./google-services.json') ? './google-services.json' : null);
  const ios = process.env.GOOGLE_SERVICE_INFO_PLIST ?? (existsSync('./GoogleService-Info.plist') ? './GoogleService-Info.plist' : null);
  if (!android && !ios) return config;

  return {
    ...config,
    android: { ...config.android, ...(android ? { googleServicesFile: android } : {}) },
    ios: { ...config.ios, ...(ios ? { googleServicesFile: ios } : {}) },
    plugins: [
      ...(config.plugins ?? []),
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      // React Native Firebase on iOS needs static frameworks.
      ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    ],
  };
};
