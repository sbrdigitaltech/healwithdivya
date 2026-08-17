# Heal with Divya

Marketing site for **Divya Rastogi, MPT** — physiotherapist, sports & orthopaedic rehab.
Hyderabad, and online across India.

Live: **https://divyamrastogi.github.io/healwithdivya/**

Implemented from the Claude Design source `Divya Rastogi Physio.dc.html`, using the
Ahaara design system tokens with the MotionFlex teal brand (`#056785 → #01ABBF`).

## Stack

Static HTML/CSS/JS — no build step, no dependencies. Open `index.html` or serve the
folder and it runs.

```bash
python3 -m http.server 8000
```

| File | Purpose |
|---|---|
| `index.html` | The whole page. |
| `styles.css` | Design tokens (ported from the Ahaara design system) + all component styles. |
| `booking.js` | Two-step booking panel: day/slot picker, concern chips, optional voice note. |
| `assets/` | Brand marks and photography. |

## Booking panel

The panel is **front-end only**. Picking a slot and confirming builds a prefilled
`wa.me` link so the patient sends the details to Divya on WhatsApp — nothing is stored
and no email is sent.

The voice note records in the browser and plays back locally; it is **not** uploaded
anywhere. If you want submissions captured server-side, wire the confirm step to a
backend before promoting this page.

Consulting hours live in `SLOTS_BY_WEEKDAY` in `booking.js`, keyed by weekday
(1 = Mon … 6 = Sat). The date strip rolls forward automatically from the current
date and skips Sundays.

## Still to swap in

- [ ] `assets/divya-portrait.png` — hero portrait. Not yet present; a branded panel
      shows in its place. Drop the file in and it takes over automatically.
- [ ] `assets/motionflex-logo.png` — the tall stacked logo lockup. The footer currently
      reuses `motionflex-mark.png`.
- [ ] **Patient stories** — the three quotes are placeholders and are labelled as such
      on the page. Replace with real quotes and photos (with written consent) or remove
      the section.
- [ ] **Reel stills** — the four Watch tiles show placeholders and link to Instagram.
- [ ] **Experience page** — the "Full experience and certifications" link is marked
      coming soon. The sibling designs (Experience, Content, Exercises, Booking) are not
      implemented yet.

## Deploy

GitHub Pages serves `main` from the repository root. Push to `main` and it redeploys.
