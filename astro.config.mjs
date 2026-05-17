import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://guide-perols-montpellier.pages.dev',
  trailingSlash: 'never',
  build: { format: 'directory' },
});
