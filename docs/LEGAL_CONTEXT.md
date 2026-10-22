# Legal context and calculation boundaries

Stage 6, reviewed 23 October 2026. SchengenStay is an independent arithmetic
tool. No result grants permission to enter, stay, work or re-enter.

## What is supported

The existing engine evaluates complete, caller-identified **countable short-stay
dates** under the standard rolling 90/180 rule. This arithmetic can describe
visa-free or C-visa travel; it does not determine who needs a visa or compliance
with a visa. The user must separately confirm countability and completeness.
An empty history is not treated as confirmed absence of travel without that
declaration. Ongoing presence requires its explicit through-date confirmation;
planning still requires an actual exit. Historical violations and proposed-trip
results remain separate. A remaining-days snapshot is not a future stay allowance.

An optional selector makes unsupported situations explicit. Its choices describe
**what the request depends on**, not verified personal status:

| Context | Result before arithmetic |
| --- | --- |
| `ARITHMETIC_ONLY` | Continue to existing scope/history/plan validation; no legal assessment |
| `UNKNOWN` or explicitly missing context details | `INSUFFICIENT_DATA` |
| `SHORT_STAY_VISA` (request to assess C-visa conditions) | `OUT_OF_SCOPE` |
| `LONG_STAY_VISA` or `RESIDENCE_PERMIT` affecting which dates count | `OUT_OF_SCOPE` |
| `PENDING_APPLICATION`, including a receipt or stamp | `OUT_OF_SCOPE` |
| `NATIONAL_EXTENSION` or `BILATERAL_ARRANGEMENT` | `OUT_OF_SCOPE` |
| `MIXED_HISTORY` or another special context | `OUT_OF_SCOPE` |
| Malformed context or inconsistent dates | `INVALID_INPUT` |

Arithmetic-only never overrides missing history, uncertain countability,
unsupported scope, input errors or computational limits. C-visa assessment
declines the distinct question of compliance with visa conditions; it does not
prohibit C-visa holders from using arithmetic-only mode for confirmed countable
short stays. A known special or uncertain context must not be relabeled simply
to obtain numbers.

## Narrow visa-date consistency check

Within the C-visa assessment choice, optional sticker dates are checked for
strict ISO format, real calendar dates and chronological order using existing
Python parsing. Missing endpoints produce `INSUFFICIENT_DATA` in the separate
date check; malformed/reversed dates produce `INVALID_INPUT`. Equal dates are
structurally consistent. Success has **no status verdict** (`status: null`) and
the reason `VISA_DATE_ORDER_ONLY`, never visa `WITHIN_RULE`. The request remains
`OUT_OF_SCOPE` for visa assessment even with consistent dates. Invalid data
takes precedence over unsupported scope.

These dates are **not** compared with history or hypothetical trips. There is no
automatic assignment of travel to a visa, assessment of its validity, grace
period, extension, entry balance or authorised duration. No search is capped or
approved from visa dates. Entry limits are intentionally unsupported: trip rows
are not evidence of external entries used under a particular visa. Unknown fields
such as `entries`, `authorised_days`, nationality or document IDs are rejected,
not interpreted or silently ignored.

## Source register and exact use

These official sources were opened and read on 23 October 2026. They support the
limitations and narrow date-field meaning below, not exhaustive legal review or
live-calculator parity.

| Official source | Verified scope used here |
| --- | --- |
| [Commission short-stay calculator](https://home-affairs.ec.europa.eu/policies/schengen/border-crossing/short-stay-calculator_en) | Rolling arithmetic, exclusion of periods under long-stay/residence grounds, and the warning that a visa authorising fewer than 90 days needs separate handling. Its broad permit wording is not interpreted as a universal travel exemption. |
| [Commission visa FAQ](https://home-affairs.ec.europa.eu/document/download/dae5e071-1564-4a5d-9714-2147f7641781_en?filename=FAQs.pdf), questions 14–16 | Entry limits are distinct; travel in other Schengen states with a permit/long-stay visa still has short-stay limits; a visa alone does not guarantee admission. Unrelated application/extension procedures are not used. |
| [Netherlands government: visa sticker fields](https://www.netherlandsworldwide.nl/visa-the-netherlands/information-on-a-visa), “From and until”, “Duration of stay”, “Number of entries” | Distinguishes bounds, duration, entries and territory. Bounds describe first possible entry/latest departure, supporting a check that an entered pair is not reversed. No entitlement calculation is derived from its sample visa. |
| [German Federal Foreign Office: visa validity](https://manila.diplo.de/ph-en/service/visa/faq-gq-visa-validity-meaning-1728050) | Corroborates the distinct meaning of validity dates and authorised duration. No German national immigration rule is generalized. |

EUR-Lex's consolidated Visa Code URL returned an anti-bot/JavaScript challenge
during review. No new definitive rule relies on that inaccessible text. Pending
applications, stamps, extensions, bilateral grounds, nationality and national
residence rights were **not independently specified or verified**. The app
declines to adjudicate them; it does not claim they always do or never do confer
rights. Consult the competent authority.

## Audit, privacy and remaining limits

The audit found that generic scope choices obscured mixed histories, history
edits retained earlier completeness/countability declarations, and the bridge
discarded unrecognized fields within records. Stage 6 adds specific reasons,
resets declarations after history changes and rejects unknown trip/proposal
fields. Notes remain uninterpreted text, not a legal classifier. Existing valid
legacy requests retain their behavior; see architecture section 18.

Context and visa drafts stay in memory even with history saving enabled. Reload
requires fresh declarations; no visa facts enter the saved schema. No identity
numbers, nationality, scans or uploads are collected. Only static assets are
downloaded; calculation data stays local. No backend, account, paid API, new
dependency or public deployment was introduced.

User declarations cannot be independently verified. Territorial/historical
classification, per-visa entry/duration attribution, mixed grounds and legal
authorisation remain unsupported. Sources can change. Recheck scope during
separately authorized release validation; tests are not legal certification.
