# Optional website analytics: consent prepared, activation blocked

Reviewed 23 October 2026. Hosting remains GitHub Pages at
https://mr-egr.github.io/SchengenStay/. The owner supplied a public Web Analytics
site token for `mr-egr.github.io`; it is a website identifier, not an account
credential. **No analytics requests occur in this build, even after opt-in.**
The requested safe-preparation fallback applies because a reliable private
collection/withdrawal lifecycle could not be verified.

## Independent consent preference

Settings uses the existing panel, checkbox and button components in English and
Russian. There is no banner, redesign or change to calculation behavior. The
notice describes Cloudflare as a third party, page views, page URLs/referrers,
technical performance and network metadata. It does not promise anonymity.
It explicitly distinguishes saving a preference from activating tracking and says
fresh consent will be required before any future activation.

- OFF by default; no preference is written until the user chooses.
- `schengenstay.analytics-consent.v1` stores only `schema_version: 1`,
  `notice_version: 1`, boolean `allowed`, and an `expires_at` timestamp.
- Choices expire after 180 days. Exact keys, types, versions, canonical JSON and
  bounded length/expiry are validated; corrupt, duplicate, expired and unknown
  records fail closed with a readable notice. No identifiers are generated.
- Travel-history storage remains a different key and consent. Saving, disabling
  or deleting travel history cannot grant or erase analytics consent. Withdrawal
  does not delete trips or invalidate results.
- Withdrawal is available any time and propagates to other open tabs. Another
  tab cannot silently grant consent to an already open tab. Reload can restore a
  valid saved choice. Blocked storage produces an error; withdrawal takes effect
  in memory and attempts to delete its own key if saving fails.
- Both grants and refusals expire. If deletion is also blocked, the UI explains
  how to clear the old choice in browser settings. Already transmitted requests
  could not be recalled by withdrawal; no such requests are sent by this build.

Notice version 1 is preparation only. **Do not reuse these saved grants to start
tracking later.** Future activation must change the notice version, request fresh
consent and enforce expiry/revocation before collection throughout the lifecycle,
including resumed tabs and already-running third-party code.

## Fail-closed implementation

`analytics-config.js` retains the issued public token with `enabled: false` and
`reviewed: false`. `analytics.js` deliberately has no script insertion or network
path. Even changing configuration flags or saving consent cannot load a provider.
The previous direct-injection preparation was removed because deleting its script
would not stop listeners installed by the beacon. Its independent bootstrap import
still tolerates missing modules/errors without blocking the application.

The existing HTML CSP does **not** permit Cloudflare script or collection hosts.
There is no preload, preconnect, third-party tag, analytics worker, custom event,
visitor identifier or transmission of application state. Python, bridge, planning,
date components and travel-history storage behavior are unchanged.

Routes use a fixed set of screen fragments. Form dates, labels, notes, legal
context and results do not become route/query values. The application does not
send them in network payloads. A user-supplied query in the address bar still
reaches GitHub as an ordinary document request; it is not an app-generated URL or
analytics payload. Future activation must reject unexpected queries/fragments and
private incoming referrers before loading, rather than claiming that `spa: false`
sanitizes them. Do not put personal information in shareable URLs.

## Official beacon inspection and failed isolation probe

On 23 October 2026, normal Chrome loaded the official
`https://static.cloudflareinsights.com/beacon.min.js` with HTTP 200: 31,853 bytes,
SHA-256 `637381256384554e1cc3309a62fb238a51b83e7f10b2a56d8ba15dbc73ca762e`.
The inspected beacon reported version 2026.10.1. This is audit evidence, not a
pinned redistribution of the vendor script. It can change upstream.

The code registers lifecycle listeners and performance observers and sends
XHR/sendBeacon traffic. No supported public stop/teardown API was verified.
Removing a script element does not undo its listeners. A main-document script
also has DOM privileges; performance element attribution makes an absolute claim
that it cannot access user inputs inappropriate. No input-text extraction was
observed in the inspected code, but that is not isolation from future changes.

A private, synthetic browser harness tested an opaque-origin sandbox iframe
(`allow-scripts`, without `allow-same-origin`). No harness was deployed or added
to the production build. After an explicit test-consent click:

- The official script loaded (HTTP 200). Parent input DOM access was blocked.
- One POST was attempted to `https://cloudflareinsights.com/cdn-cgi/rum`.
- Chrome reported: `Access to XMLHttpRequest at 'https://cloudflareinsights.com/cdn-cgi/rum' from origin 'null' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.`
- Collection then failed with `net::ERR_FAILED`. Successful ingestion and dashboard
  statistics were **not** verified. A request event is not proof of ingestion.
- The inspected attempted payload contained the fixed harness URL, a transient
  page-load ID, timings/memory/version and the public site token, not the synthetic
  travel-input canary. Removing the frame produced no further POST attempts in
  the observed three-second interval. This is limited observation, not a general
  verified withdrawal mechanism.

An isolated frame would also measure the frame rather than actual calculator
performance. Do not weaken isolation, add same-origin access, bypass CORS, inject
private data into a frame or invent unsupported options to obtain a successful
request. This Chrome result is not a claim about every vendor/browser configuration.

## Remaining activation gates

A supported implementation must both prevent access to private application data
and stop all future collection on withdrawal without losing unsaved travel work.
A main-page script-removal approach is insufficient; the tested isolation approach
failed collection. Verify a supported vendor lifecycle/isolation mechanism before
restoring any loader. An alternative provider or changed collection approach needs
an explicit scope decision, not a silent substitution.

Then update the notice/schema consent version, collect new consent, review actual
payloads and privacy settings, allow only the official hosts in CSP, rerun full
checks, and independently test the published site. Test default-off, refusal,
withdrawal, expiry, other tabs, hide/unload, reload, blocked storage, provider
outages and canary inputs. Confirm public collection separately from dashboard
visits. A script load alone proves neither. No further token is needed from the
owner for this investigation, and no hosting/DNS migration is required.

## Privacy assumptions and legal uncertainty

The conservative approach is affirmative opt-in before any optional provider
connection, with an equally accessible withdrawal control. History-saving consent
never substitutes for analytics consent. The 180-day choice lifetime is a product
decision informed by CNIL good-practice guidance, not a universal legal duration.
Provider failures or tracking blockers cannot prevent calculators, navigation or
storage from working. GitHub/jsDelivr still receive ordinary network metadata
when serving site/runtime files.

Cloudflare documentation describes a cookieless service without persistent visitor
identification or fingerprinting, but its edge receives request metadata and the
beacon includes real-user performance monitoring, URLs/referrers and transient
page-load IDs. Aggregate reporting does not prove that every field is legally
anonymous. `spa: false` does not disable all performance collection.

No complete legal-compliance or universal consent-exemption claim is made.
Operator/visitor jurisdictions, processing terms, retention, transfers and the
final notice must still be assessed for any activated implementation. CNIL
exemptions are conditional; its guidance does not certify this website. GitHub
Pages does not inherit Cloudflare proxy-based regional exclusions.

## Official sources reviewed

- [Manual setup](https://developers.cloudflare.com/web-analytics/get-started/): hostname registration and official non-proxied snippet.
- [SPA configuration](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/): documented `spa: false`, not a performance-off or withdrawal API.
- [Data endpoints and collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/): official script, collection URLs and lifecycle behavior.
- [RUM collection and privacy](https://developers.cloudflare.com/speed/observatory/rum-beacon/): performance fields, page ID, referrer/landing URLs and network metadata.
- [Core Web Vitals](https://developers.cloudflare.com/web-analytics/data-metrics/core-web-vitals/): performance and element attribution.
- [Provider privacy approach](https://blog.cloudflare.com/the-rum-diaries-enabling-web-analytics-by-default/): provider claims about cookies and visitor identification.
- [CNIL consent requirements](https://www.cnil.fr/fr/cookies-et-autres-traceurs/que-dit-la-loi): affirmative choice and accessible withdrawal.
- [CNIL consent FAQ](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ): withdrawal and consent controls.
- [CNIL consolidated recommendation, January 2026](https://cnil.fr/sites/default/files/2026-01/recommandation_cookies_consolidee.pdf): choice-duration good practice, not a universal exemption.
