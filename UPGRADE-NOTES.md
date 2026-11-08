# DFW After Dark v2: what changed and how to ship it

## Ship it
1. Unzip `dfw-after-dark-v2.zip`. Upload the *contents* of the `dfw-after-dark/` folder to the root of the GitHub repo `justinliles/dfw-after-dark` (replace `index.html`, `styles.css`, `app.js`, `netlify.toml`, `README.md`; add `fonts/`, `vendor/`, `assets/`). Leave `data/` and `editions/` as they are.
2. Netlify deploys on push. Publish directory stays `.` with no build command.
3. Test any date: `/?preview=2026-11-12`.
4. Check `<link rel="canonical">` and `og:url` in `index.html`. They point at dfwdaily.midnightmeta.dev. Change them if the live domain is different.

## Design
- Direction: a Dallas night out. Indigo sky, neon pink, a Reunion Tower skyline, and every event as a ticket stub with a perforated edge. The neon wordmark switches on once at load.
- Type: Big Shoulders Display (poster condensed) for headlines and titles; Hanken Grotesk for reading. Both self-hosted.
- Hero shows the soonest real event ("Next up") instead of a slogan alone.

## UX fixes and additions
- Sticky 7-day strip with event-count dots per day (also reflects active filters).
- Events grouped under day headings (Today, Tomorrow, Friday...).
- Category chips with counts replace the dropdown. Dropdown no longer lists categories that only exist in the anytime spots (previously gave empty results).
- Finished events hide automatically. Multi-day events show "Fri-Sun" or "Through Sun" with correct time ranges.
- Add to calendar (.ics) on every event.
- Map: category-colored pins, venues on the same block no longer stack, hover a card to light its pin, tap a pin to jump to its card. Anytime spots show as hollow dots.
- Mobile: List / Map switch instead of a long stacked map.
- Helpful empty and error states with a Clear filters button.
- Saved events survive private-mode storage errors.
- Accessibility: skip link, visible focus, aria-pressed on all toggles, labelled day buttons, reduced-motion respected.
- Performance and reliability: no Google Fonts or unpkg calls, long cache headers for fonts/vendor.

## Left alone on purpose
- Data schema and the ChatGPT publishing contract.
- Map tiles still come from CARTO (needs internet, no key).
