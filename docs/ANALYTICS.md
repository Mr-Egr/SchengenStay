# Optional website analytics: prepared, inactive

Reviewed 23 October 2026. Hosting remains GitHub Pages at
https://mr-egr.github.io/SchengenStay/. No account credential or real site token
has been provided. There are **no analytics requests in this build**. Travel data,
calculation results and legal-context inputs remain local.

## Implementation and activation boundaries

`analytics-config.js` contains `enabled: false`, `siteToken: null`, and
`reviewed: false`. The optional loader is imported independently of application
startup. A missing module, blocked script or initialization exception cannot block
the calculator. It has no application-state, form, bridge or storage dependency.
No custom events, identifiers, tracking storage or application payloads are added.

The prepared loader uses only Cloudflare's official
`https://static.cloudflareinsights.com/beacon.min.js` module with `spa: false`.
Token shape validation does not verify registration; only an issued token for
this hostname may be configured. Loading requires the exact HTTPS repository path,
known route fragments, no query string and no incoming referrer (to avoid passing
private referring URLs). GPC and Do Not Track suppress loading. These exclusions
undercount visits by design. The current URL is never changed. Insertion does not
prove successful collection. Optional analytics errors never hide calculation errors.

The existing HTML CSP deliberately does **not** allow Cloudflare's script or
collection hosts. Neither a token nor a toggle alone activates analytics. There
is no preload, preconnect or active third-party tag. Unit fixtures use synthetic
token-shaped strings only with fake documents; none are deployed or sent anywhere.

## Collection-scope limitation

The standard Web Analytics beacon also provides real-user performance monitoring.
Official documentation lists timings, Web Vitals, referrer/landing URLs and a
transient page-load ID. Disabling SPA measurement does **not** establish a
page-view-only mode. No supported switch removing all performance collection has
been verified. Do not claim it collects literally only aggregate page counters.

The requested strict page-view-only scope remains an activation gate, alongside
the missing token. Confirm a supported configuration with Cloudflare. If it cannot
meet that scope, keep analytics off and request an owner decision. Do not invent
unsupported beacon options, custom tracking or a proxy/backend workaround.

## Manual setup: no DNS or hosting migration

1. Sign in to a free Cloudflare account and open **Web Analytics**.
2. Select **Add a site**, enter **mr-egr.github.io** (hostname only, not the
   `/SchengenStay/` path), select the hostname, then **Done**.
3. Open **Manage site** and view the manual JavaScript snippet for this non-proxied
   site. Do not migrate to Cloudflare Pages or enable a Cloudflare proxy.
4. Provide only the public `token` value inside `data-cf-beacon` to the maintainer.
   This is not a Global API Key, API token, password or account credential.
   Never provide those secrets or commit them.
5. **Stop before activation.** Resolve the collection-scope issue and review
   applicable privacy/consent requirements. Local history-saving consent is not
   analytics consent. If prior consent is required, implement it before loading.
6. After review, the maintainer must verify registration, configure the issued
   token, update the exact privacy notice and permit only the official script and
   non-proxied endpoint `https://cloudflareinsights.com/cdn-cgi/rum` in the respective
   CSP directives. Run all checks and publish through the existing Pages workflow.
7. Independently inspect the public site's requests with synthetic dates, notes,
   visa context and results, including edits, navigation, hide/unload and reload.
   Confirm none appear in payloads, no custom events or persistent visitor IDs
   exist, and the dashboard receives traffic. Test blocking, provider failure and
   any consent/objection controls. A script load alone does not prove activation.

## Privacy notice and legal review

Settings says analytics is **off** and that aggregate traffic statistics, if
activated, would be separate from locally processed travel data. Memory defaults,
optional browser saving and deletion remain unchanged. GitHub/jsDelivr still
receive ordinary network metadata when serving website/runtime files.

Cloudflare describes Web Analytics as cookieless and without persistent visitor
identification or fingerprinting. Its edge still receives HTTP metadata.
Aggregate reports do not establish that every underlying field is anonymous under
every law. External scripts execute with page privileges and can change upstream;
activation requires reviewing the real beacon and payloads, not just our adapter.

No universal consent exemption or legal-compliance claim is made. CNIL's exemption
has conditions beyond a vendor's privacy-first description. Operator/visitor
jurisdictions, notices, processing terms, retention, international transfers and
consent/objection requirements must be reviewed before activation. No analytics
consent flow is needed for this disabled preparation; this is not a conclusion
about a future enabled service. GitHub Pages does not automatically receive
Cloudflare proxy-based EU exclusions.

## Official sources checked

- [Manual setup](https://developers.cloudflare.com/web-analytics/get-started/): hostname registration and manual snippet for non-proxied sites.
- [SPA configuration](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/): documented `spa: false` option.
- [Data endpoints](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/): official script and collection URLs.
- [RUM collection and privacy](https://developers.cloudflare.com/speed/observatory/rum-beacon/): performance fields, page ID, referrer/landing URLs and network metadata.
- [Provider privacy approach](https://blog.cloudflare.com/the-rum-diaries-enabling-web-analytics-by-default/): no cookies, persistent visitor identification or fingerprinting.
- [CNIL audience measurement guidance](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience): conditional exemptions and publisher responsibility; no certification of this site.
