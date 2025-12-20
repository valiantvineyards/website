// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import rehypeExternalLinks from './src/plugins/rehype-external-links.js';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://valiantvineyards.us',
  prefetch: {
    defaultStrategy: 'hover'
  },
  integrations: [svelte(), mdx(), sitemap()],
  markdown: {
    rehypePlugins: [rehypeExternalLinks],
  },
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '$lib': '/src/lib'
      }
    }
  }
});