// Minimal Expo Metro config: resolve the committed preventive-care `.svg`
// scenes as static file assets so the static require() calls in
// src/components/healthcare/preventiveItems.ts bundle on native + web.
// No new dependencies, no SVG transformer introduced — rendering stays in
// PreventiveMediaCell (web <img> overlay, native offline RN scenes).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes('svg')) {
  config.resolver.assetExts.push('svg');
}

module.exports = config;
