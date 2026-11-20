import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Generates PNG app icons from the source SVG:
//   npm run generate-pwa-assets
// Output (committed to public/): pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
// maskable-icon-512x512.png, apple-touch-icon-180x180.png, favicon.ico
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    // Match the app background so padded maskable/apple icons blend in.
    maskable: { ...preset.maskable, resizeOptions: { background: '#020810' } },
    apple: { ...preset.apple, resizeOptions: { background: '#020810' } },
  },
  images: ['public/icon-512x512.svg'],
});
