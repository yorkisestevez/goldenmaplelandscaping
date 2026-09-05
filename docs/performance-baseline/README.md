# Core Web Vitals — public field-data baseline

Observed 2026-09-05 using the existing browser_operator engine and public PageSpeed Insights. Read-only public checks; no API keys, account changes, or deployment.

| Requested URL | Device | Real-user field result | Report |
|---|---|---|---|
| https://goldenmaplelandscaping.ca/ | Mobile | **No Data** | https://pagespeed.web.dev/analysis/https-goldenmaplelandscaping-ca/1zf79bzv5j?form_factor=mobile |
| https://seo.goldenmaplelandscaping.ca/ | Mobile | **No Data** | https://pagespeed.web.dev/analysis/https-seo-goldenmaplelandscaping-ca/g3960q6iw7?form_factor=mobile |

No real-user LCP, INP, CLS, or field pass/fail can be reported from these responses. This is not a Core Web Vitals pass and is not proof that every URL/device/origin has no CrUX data. No authenticated Search Console CWV export has been obtained in this check.

The SEO-origin homepage report also produced Lighthouse lab output; it is not a substitute for real-user field data and does not establish performance of the service-city URLs. Main-origin lab completion was not awaited before the text capture because this check's scope is field-data availability. The subsequent screenshot did capture a completed mobile lab report: performance **49**, FCP **3.6 s**, LCP **12.3 s**, TBT **530 ms**, CLS **0**, Speed Index **6.0 s**. It also shows accessibility **83**, best practices **81**, and SEO **100**. These are a single simulated test, not real-user CWV. The screenshot identifies image-delivery savings, render-blocking requests, and main-thread work as follow-up performance targets; remediation is outside this facts/migration pass.

## Evidence and reproduction

- `field-data-evidence.json`: timestamp, final report URL, wait error (null for both final observations), rendered public text.
- `*-pagespeed.txt`: rendered report text.
- `*-pagespeed.png`: full-page screenshots.
- `../../scripts/check-cwv-field.py`: uses browser_operator, waits for a field result/error rather than the initial loading heading, then captures the report. A timeout is recorded explicitly and must not be interpreted as No Data.

Run from the site repository with the existing Playwright-compatible Python environment:

```
C:/Users/yorki/hermes/hermes-agent/venv/Scripts/python.exe scripts/check-cwv-field.py
```

This overwrites local audit evidence only and starts public Google diagnostic reports. Do not interpret any lab score as a field-data metric.
