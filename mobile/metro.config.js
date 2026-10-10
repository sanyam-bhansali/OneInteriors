// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/* The website's pure modules (brief types, the matcher, the quote engine,
   money) are imported straight from ../src rather than copied, so a rule
   fixed on the website is fixed in the app. Metro only bundles files it
   watches, and ../src is outside this project. */
config.watchFolders = [path.resolve(__dirname, '../src')];

module.exports = config;
