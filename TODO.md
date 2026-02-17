# TODO

- [ ] Make "Past Event" badge dynamic (client-side) instead of static/build-time. Currently, event past/upcoming status is determined at build time in `src/pages/index.astro`, so the homepage can show stale badges until the site is redeployed. A client-side check would keep it accurate without requiring a rebuild.
