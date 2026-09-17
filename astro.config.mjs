// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import externalLinks from './src/plugins/external-links.js';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://valiantvineyards.us',
  prefetch: {
    defaultStrategy: 'hover'
  },
  integrations: [svelte(), mdx(), sitemap()],
  markdown: {
    processor: satteri({ hastPlugins: [externalLinks] }),
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