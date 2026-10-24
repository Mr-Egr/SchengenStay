# Screenshot provenance

The portfolio images were captured on 24 October 2026 from the public
[GitHub Pages application](https://mr-egr.github.io/SchengenStay/) at deployed
commit `15d2014`. They are direct Chrome 155 screenshots, without edited DOM,
composited results or mocked calculations. Original project screenshots are
covered by the [MIT license](../../LICENSE).

| Image | Actual view and input |
| --- | --- |
| [Overview](portfolio-overview.png) | English, light theme, 1440 × 1000 viewport; empty history and no calculated values. |
| [Calculation](portfolio-calculation.png) | English, light theme, 1440 × 1000 viewport scrolled to the result. Synthetic completed stay from 1 to 30 January 2026; check date 31 March 2026, explicitly complete and countable standard-short-stay history. Real Python result: `WITHIN_RULE`, 30 used and 60 remaining arithmetic days. |
| [Mobile date picker](portfolio-mobile-ru.png) | Russian, dark theme, 390 × 1000 viewport; the same synthetic history, check date edited to 30 September 2026 and the calendar opened. Editing invalidates the earlier calculation. |

Only normal UI controls and viewport/scroll settings were used. No history was
saved, no analytics consent was granted, and no personal travel data was used.
Mobile-sized screenshots demonstrate layout, not physical-device testing.
The calculation is an arithmetic example, not travel authorization.

The earlier `overview-desktop.png`, `overview-mobile.png` and
`date-picker-mobile-ru-dark.png` remain as historical captures referenced by
existing technical records. Some contain older interface wording. The public
README uses the current portfolio captures above.
