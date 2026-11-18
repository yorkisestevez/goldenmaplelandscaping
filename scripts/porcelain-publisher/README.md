# Porcelain publication

`content/porcelain/queue.json` is the source for the 52-article series. Each entry uses the Toronto publication date and its corresponding UTC instant. The first article is due November 7, 2026. The other 51 are due on Mondays at 9 a.m. Toronto time from November 9, 2026 through October 25, 2027.

The npm development, lint and build commands materialize due articles automatically. To generate them on demand, run `node scripts/porcelain-publisher/materialize.cjs` from the checkout. Commit the queue and the two empty publication blocks in the route and index sources. The generated page directory is ignored. Use a clean checkout if the compiler reports stale output after changing the queue or using an earlier clock in a test.

The weekly GitHub workflow checks the calendar on main, records one request for each due week in content/porcelain/dispatch-receipt.json, and starts the existing Netlify deploy. The receipt records the request time. Confirm publication from the deploy outcome and the live article. Weekly receipt commits provide repository activity so GitHub can keep the public repository schedule enabled. Retrying in the same week can start another deploy without another receipt commit. Manual dispatch of the weekly workflow uses the same calendar guard. The last dispatch window closes at midnight Toronto time on November 1, 2027. The scheduled workflow starts a build, so the live publication time depends on GitHub scheduling and the deployment.

Run the focused tests with `node --test scripts/porcelain-publisher/materialize.test.cjs`.
