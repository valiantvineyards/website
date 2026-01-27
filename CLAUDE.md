# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production (static site)
npm run preview  # Preview production build locally
```

No test framework is configured; this is a content-focused static site.

## Tech Stack

- **Astro v5** — Static site generator (output: `static`)
- **Svelte v5** — Interactive components (island architecture)
- **Tailwind CSS v4** — Styling via Vite plugin
- **shadcn-svelte** — UI component library (base color: stone)
- **MDX** — Content authoring with custom rehype plugins
- **Cloudflare Pages** — Hosting + serverless functions

## Architecture

### Content Collections

Content lives in `src/content/` as MDX files with YAML frontmatter. Schemas are defined in `src/content.config.ts`:

- **Events** (`src/content/events/`): title, description, date, eventDate (optional), featuredImage, pinned, draft
- **Stories** (`src/content/stories/`): title, description, date, featuredImage, pinned, draft

Sorting: pinned items first, then by date (events use `eventDate` with `date` fallback).

### Centralized Site Data

`src/data/site-info.ts` exports hours, contact info, address, and social links. Edit this file to update business information site-wide.

### Serverless Functions

`functions/api/` contains Cloudflare Pages Functions:
- `contact.ts` — Form handling with Resend (email), Turnstile (CAPTCHA), and Mailchimp (newsletter)
- Email recipients configured via `EMAIL_CONFIG` object in `contact.ts`

### Path Alias

`$lib` → `src/lib` (configured in both `astro.config.mjs` and `tsconfig.json`)

## Key Files

- `src/data/site-info.ts` — Business hours, contact, address
- `src/content.config.ts` — Content collection schemas
- `functions/api/contact.ts` — Contact form backend
- `src/layouts/BaseLayout.astro` — Primary page template
- `src/plugins/rehype-external-links.js` — Opens external links in new tabs

## Adding Content

**Events**: Copy `src/content/events/0-TEMPLATE.mdx`, rename, update frontmatter
**Stories**: Copy `src/content/stories/0-TEMPLATE.mdx`, rename, update frontmatter

## Environment Variables

Required in Cloudflare Pages dashboard:
- `RESEND_API_KEY` — Email delivery
- `MAILCHIMP_API_KEY` — Newsletter subscriptions
- `TURNSTILE_SECRET_KEY` — CAPTCHA validation
- `MAPBOX_ACCESS_TOKEN` — Static map on contact page (optional)

## Git Workflow

- **Never commit directly to `main`** — Always create a feature branch first. GitHub requires a PR for all merges into main; pushing directly is prohibited.
- Do not include "Co-Authored-By" lines in commit messages.
- Do not include "Created with Claude Code" or similar attribution lines in pull request descriptions.
