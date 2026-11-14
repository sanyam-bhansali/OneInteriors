const { existsSync } = require('fs');

/**
 * Firebase's native code only when Firebase is set up (14 Nov 2026: the first
 * Android test build failed compiling @react-native-firebase/auth with no
 * Firebase files, "Module was compiled with an incompatible version of
 * Kotlin"). app.config.js adds the Firebase plugins only when its files are
 * there; this leaves the packages out of the native build the same way, so a
 * build without them is the plain app. src/lib/phone-code.ts loads Firebase
 * lazily and falls back to the older sign-in when it is missing.
 */
const firebase =
  Boolean(process.env.GOOGLE_SERVICES_JSON || process.env.GOOGLE_SERVICE_INFO_PLIST) ||
  existsSync(`${__dirname}/google-services.json`) ||
  existsSync(`${__dirname}/GoogleService-Info.plist`);

module.exports = firebase
  ? {}
  : {
      dependencies: {
        '@react-native-firebase/app': { platforms: { android: null, ios: null } },
        '@react-native-firebase/auth': { platforms: { android: null, ios: null } },
      },
    };
