# Static deployment and publication

Stage 8 uses free GitHub Pages with the existing Pyodide architecture. Production
verification and the final URL are recorded below only after they actually pass.
No backend, account, analytics, paid API or commercial feature is introduced.

## Build and preview

Python build/test dependencies are exact-pinned in requirements-dev.txt; setuptools
is also pinned in pyproject.toml. npm's committed lockfile pins Playwright and its
test-only transitive dependencies with integrity digests. Python runtime dependencies
remain empty. CI action versions are pinned to reviewed upstream commit SHAs.
Hosted OS/interpreter patches and nested upstream action dependencies are not frozen.

```sh
python -m pip install -r requirements-dev.txt
python -m pip install --no-build-isolation --no-deps -e .
npm ci --ignore-scripts
python scripts/build_browser.py --check
python scripts/build_site.py
python scripts/build_site.py --check
python -m http.server 8765 --bind 127.0.0.1 --directory dist/site
```

The build writes only 28 explicitly reviewed files to ignored `dist/site/`.
Unknown web files, symlinks, unexpected output files or stale Python archives
block publication. It never recursively deletes an arbitrary output directory.
Text uses canonical LF; the Python ZIP fixes metadata and includes MIT LICENSE;
file timestamps are fixed. `site-manifest.json` records version and SHA-256 for
every other deployed file. Its bytes depend only on source, not build time or host.
The ZIP contains the 11 original Python modules and their license, no dependencies.

No repository documentation, tests, screenshots, virtual environment, node_modules,
source maps, credentials or build tools enter the website artifact. Original
JavaScript and Python source remain intentionally readable open-source assets.
GitHub serves the repository separately as an explicitly public source project.

All application URLs are relative. Both browser suites serve the build under
`/SchengenStay/`; production tests accept the exact Pages API URL via `SITE_URL`
(including its trailing slash). Set `WEB_ROOT=dist/site` for local build tests.
The browser harness now preserves the trailing slash during initial navigation;
the original root-only harness did not require it.

## Quality-gated publishing

The existing **Project checks** workflow retains push/pull-request CI. Publishing
is an explicit **workflow_dispatch** on `main`, with `publish=true`; ordinary
pushes, PRs and tags cannot deploy. This prevents an unreviewed push or release
tag from automatically publishing. A publishing run reruns every quality check.

Both Ubuntu and Windows build and test the production directory, including all
26 UI/accessibility checks, real Pyodide journeys and 99 native/browser comparisons.
Only Ubuntu uploads its exact tested directory through `upload-pages-artifact`.
The deployment job `needs` the complete successful two-platform matrix and uses
that artifact without rebuilding. Deployment is serialized without cancellation.
No failed, incomplete or merely queued quality job can publish.

Checks have only `contents: read`, and checkout does not retain Git credentials.
Only the deployment job receives `pages: write` and `id-token: write`, under the
`github-pages` environment. There are no stored deployment secrets or access keys.
All six top-level actions use verified official commit SHAs and Node 24 runtimes.
Pages must first be enabled with build type `workflow`; the workflow does not
silently enable a site or change visibility. See [GitHub's official workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

Maintainer procedure (after reviewing local checks and intended commit):

1. Confirm clean/synchronized `main`, review the publication scan and notices.
2. In repository **Settings → Pages → Build and deployment → Source**, select
   **GitHub Actions**. The equivalent API creates `/repos/Mr-Egr/SchengenStay/pages`
   with `build_type: workflow`; read `html_url` back rather than guessing the URL.
3. Restrict the `github-pages` environment to branch `main` under Settings → Environments.
4. Actions → **Project checks → Run workflow**, choose `main`, enable `publish`.
   CLI equivalent: `gh workflow run ci.yml --ref main -f publish=true`.
5. Require both matrix checks and deployment to pass. Read the Pages URL/settings
   and deployment record; test anonymously with fresh browser contexts.
6. Verify production file digests against the tested manifest, all seven screens,
   real Python results and scope/privacy gates. Only then tag/release v1.0.0.

For rollback, select a previously verified commit by a new normal revert commit,
rerun checks and explicitly republish. Never force-push or replace existing tags.

## Security and privacy review

`python scripts/audit_publication.py` checks every blob reachable from all local
Git refs and every tracked/nonignored candidate file, including ZIP contents, for
common credential formats and sensitive/development filenames. Initial Stage 8
scan: 187 historical blobs, no matches. Full-history checkout makes this a CI gate.
The scan prints categories/paths, never matching credentials. It is deliberately
described as targeted scanning, not a guarantee against every secret format.

Manual review covers source/configuration, synthetic fixtures, archive payloads,
PNG images and original SVG/icon sources. Existing commit author names/email are
ordinary intentional Git attribution and remain public with the preserved history.
No identity documents or personal travel records were found. Ignored local test
captures, browser binaries and temporary tooling are never committed or deployed.

History defaults to memory. Saving requires consent; disabling deletes the app's
versioned key. No identity numbers, visa details, results or scenarios are saved.
Browser tests cover consent, deletion, corruption, refresh, text injection,
unknown/duplicate JSON fields, size limits and stale results. Requests contain
only static GETs: trip dates, labels and notes are not sent to GitHub/CDN/analytics.
GitHub and jsDelivr still receive ordinary network metadata, including IP address.
Same-origin localStorage is shared by sites on the same GitHub Pages hostname;
use a trusted browser profile and do not enable saving on a shared device.

The HTML has restrictive meta CSP and a no-referrer policy. GitHub Pages does not
provide application-controlled response headers: worker-response CSP, frame-ancestors
and other custom security headers cannot be asserted here. The worker uses fixed
runtime URLs and a fixed Python import; untrusted values are JSON only. Pyodide
remains pinned to 314.0.7, loaded unmodified from the CDN rather than mirrored.
CDN availability and trust remain limitations; there is no guaranteed offline reload.

## Attribution inventory

The owner approved MIT for original code, docs, SVGs/icons and screenshots:
copyright 2026 Egor Kibishev. Root LICENSE, package metadata, website LICENSE.txt
and Python ZIP agree. The MIT grant does not apply to third-party runtimes.

The footer links [third-party notices](../web/THIRD_PARTY_NOTICES.txt). Exact official
license texts are included, with source links for Pyodide 314.0.7 (MPL-2.0), CPython
3.14.2 and Emscripten 5.0.3 (MIT/NCSA). Runtime metadata was read from the pinned
distribution. Upstream license and copyright notices are retained; no runtime
binary is redistributed in our repository/artifact and no optional Python package
is installed. Corresponding Pyodide source is freely linked, with no MIT relicensing.

Fonts are system fonts; no font files are distributed. SVGs, icon paths and
screenshots originate in this project. There are no stock assets or official EU
logos. Screenshots are actual browser captures using empty/synthetic workspaces.
Commission examples are numerical test observations with provenance, not copies
of Commission software, design, PDF documents or screenshots. Development-only
Playwright is Apache-2.0; its binaries and npm tree are excluded from deployment.

## Production verification record

Pending actual publication and independent verification. No release success or
live URL is claimed by this preparation record. See PROGRESS.md for execution
results and the final GitHub Actions/Pages evidence when available.
