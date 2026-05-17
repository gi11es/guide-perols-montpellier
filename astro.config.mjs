import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://gi11es.github.io',
  base: '/guide-perols-montpellier',
  trailingSlash: 'never',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});
