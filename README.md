# DFW After Dark — ChatGPT-curated site

A static, mobile-first DFW events guide: rolling seven-day events, interactive map, category and area filters, saved listings, ticket/organizer and directions links, and anytime destinations.

## No API keys / environment variables

**Source of content:** the existing ChatGPT scheduled task “Events with Nayra.” Each scheduled run researches local event sources using ChatGPT's browsing, then updates `data/events.json` and `data/places.json` in GitHub through the connected GitHub account. Netlify deploys when GitHub pushes to the repository's default branch. There is no Ticketmaster fetch, repository secret, or site-build token.

## One-time publication

1. Create GitHub repository **justinliles/dfw-after-dark** and upload this directory's *contents* to its default branch (not the enclosing `dfw-after-dark/` folder).
2. In Netlify, open the existing project **dfw-after-dark** in Curematics team and link the GitHub repository for continuous deployment. Publish directory is repo root `.`; build command is blank (see `netlify.toml`).
3. Verify first production deploy shows events, map and links. Check next scheduled ChatGPT run writes a new `data/events.json` commit and triggers the Netlify deployment. Until verified, do not claim the website is auto-updating.

## ChatGPT daily publishing contract

- Research events for the next seven America/Chicago calendar days across DFW. Prioritize intimate jazz, concerts, galleries, author events, bookstores, maker markets, games, quirky shops, pet events, creative classes and scenic walks; include other high-quality finds.
- Verify each event's date, time, organizer/source URL, location and ticket/admission details via current organizer/venue pages where possible. Never fabricate details. Omit unverified dates. Preserve valid upcoming listings and existing evergreen destinations.
- Replace `data/events.json` with a JSON array of objects containing `id`, `title`, `category`, `start`, `end`, `venue`, `area`, `address`, `lat`, `lng`, `price`, `url`, `description`, `featured`. Both datetime fields must include Central timezone offsets valid for that date; use `null` for unknown coordinates and omit inaccurate pins. URLs must be real absolute HTTPS event/organizer links, not citation refs. Date-only multi-day programs need carefully verified day hours, not invented continuous operation.
- Keep events deduplicated and sorted chronologically; do not discard upcoming entries without verifying cancellation or expiration. Evergreen destinations go in `data/places.json`, with same display fields according to existing examples.
- Create or update a dated `editions/YYYY-MM-DD.md` written summary with source links and caveats, retaining history. The site itself reads `data/events.json` for live cards and map.
- Commit via the **personal justinliles** GitHub account. Do not write to the Growthware account. Verify the commit exists and inspect Netlify deploy outcome where supported. If publishing fails, notify the user with the exact failed stage; still provide the day's researched radar in ChatGPT.

## Design notes (v2)

- Fonts (Big Shoulders Display, Hanken Grotesk) and Leaflet are self-hosted in `fonts/` and `vendor/`, so the page no longer depends on Google Fonts or unpkg.
- The data contract is unchanged: the ChatGPT task keeps writing the same `events.json` / `places.json` fields.
- Finished events are hidden automatically; multi-day events show "Through <day>" once they have started.
- Preview any date with `?preview=YYYY-MM-DD` (or `?preview=YYYY-MM-DDTHH:mm`), for example `/?preview=2026-11-12`.
- `index.html` canonical/og URL points at dfwdaily.midnightmeta.dev. Change it if the live domain differs.

## Runtime details

All data loads from local JSON; no backend or account logins. Leaflet tiles use a public CARTO/OSM tile service. Saved events persist only in local browser storage. The page hides events outside its rolling seven-day window. Map pins are only drawn when coordinates are present. External map tiles require internet access for visitors but **no credentials**.
