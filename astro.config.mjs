// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://thetocque.org',
  trailingSlash: 'always',
  build: {
    // Emit /about/index.html so Firebase Hosting serves the WordPress-era
    // trailing-slash URLs byte-for-byte.
    format: 'directory',
  },
  integrations: [sitemap()],
  image: {
    responsiveStyles: true,
  },
});
