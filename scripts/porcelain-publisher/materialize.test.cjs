const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function publisher() {
  const modulePath = path.join(__dirname, "materialize.cjs");
  assert.ok(fs.existsSync(modulePath), "the publication compiler must exist");
  return require(modulePath);
}

const queue = {
  version: 1,
  timezone: "America/Toronto",
  entries: Array.from({ length: 52 }, (_, index) => {
    const week = index + 1;
    const date =
      week === 1
        ? "2026-11-07"
        : new Date(Date.UTC(2026, 10, 9 + (week - 2) * 7))
            .toISOString()
            .slice(0, 10);
    const hour = date >= "2027-03-14" ? "13" : "14";
    return {
      week,
      date,
      publishAt:
        week === 1 ? "2026-11-07T05:00:00Z" : date + "T" + hour + ":00:00Z",
      audience: week % 2 ? "homeowner" : "trade",
      slug: "porcelain-test-" + week,
      title: "Test title " + week,
      seoTitle: "Test SEO title " + week,
      description: "Description " + week,
      category: "Planning",
      markdown:
        "# Test title " +
        week +
        "\n\nFuture body sentinel for week " +
        week +
        ".",
      heroImage: "/logo.svg",
    };
  }),
};

const first = "2026-11-07T05:00:00Z";
const second = "2026-11-09T14:00:00Z";
const marker =
  "  // BEGIN PORCELAIN PUBLICATION\n  // END PORCELAIN PUBLICATION\n";
const routeFile = "src/routes.ts";
const indexFile = "src/data/blogPosts.ts";
const pageDir = "src/pages/blog/porcelain-scheduled";

function fixture(t, route = "", index = "") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "porcelain-test-"));
  t.after(() => fs.rmSync(root, { recursive: true }));
  fs.mkdirSync(path.join(root, "src/data"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/pages/blog"), { recursive: true });
  fs.writeFileSync(
    path.join(root, routeFile),
    "existing routes\n" + route + marker + "route suffix\n",
  );
  fs.writeFileSync(
    path.join(root, indexFile),
    "existing index\n" + index + marker + "index suffix\n",
  );
  return root;
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function snapshot(root) {
  return Object.fromEntries(
    fs
      .readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const file = path.relative(
          root,
          path.join(entry.parentPath, entry.name),
        );
        return [file, read(root, file)];
      }),
  );
}

test("selects inclusively at the first Toronto midnight and weekly DST boundaries", () => {
  const { selectDueEntries } = publisher();
  for (const [instant, before, at] of [
    [first, 0, 1],
    [second, 1, 2],
    ["2027-03-08T14:00:00Z", 18, 19],
    ["2027-03-15T13:00:00Z", 19, 20],
    ["2027-10-25T13:00:00Z", 51, 52],
  ]) {
    assert.equal(
      selectDueEntries(queue, new Date(Date.parse(instant) - 1)).length,
      before,
    );
    assert.equal(selectDueEntries(queue, new Date(instant)).length, at);
  }
});

test("allows delayed dispatch within each publication week and expires before week 53", () => {
  const { shouldDispatch } = publisher();
  for (const [instant, expected] of [
    ["2026-11-07T04:59:59Z", false],
    [first, true],
    ["2026-11-09T05:00:00Z", false],
    ["2026-11-09T13:59:59Z", false],
    [second, true],
    ["2026-11-09T17:20:00Z", true],
    ["2027-03-15T12:59:59Z", false],
    ["2027-03-15T13:00:00Z", true],
    ["2027-10-31T23:00:00Z", true],
    ["2027-11-01T03:59:59Z", true],
    ["2027-11-01T04:00:00Z", false],
    ["2027-11-01T14:00:00Z", false],
  ]) {
    assert.equal(shouldDispatch(queue, new Date(instant)), expected, instant);
  }
});

test("materializes only due article routes, index entries and files and preserves surrounding source", (t) => {
  const { materialize } = publisher();
  const root = fixture(t);
  const noPosts = snapshot(root);
  assert.equal(
    materialize({ root, queue, now: new Date("2026-11-07T04:59:59Z") })
      .published,
    0,
  );
  assert.deepEqual(snapshot(root), noPosts);

  assert.equal(materialize({ root, queue, now: new Date(first) }).published, 1);
  assert.deepEqual(fs.readdirSync(path.join(root, pageDir)), [
    "porcelain-test-1.tsx",
  ]);
  assert.match(
    read(root, routeFile),
    /^existing routes\n[\s\S]*route\('resources\/porcelain-test-1', 'pages\/blog\/porcelain-scheduled\/porcelain-test-1\.tsx'\),[\s\S]*\nroute suffix\n$/,
  );
  assert.match(
    read(root, indexFile),
    /^existing index\n[\s\S]*porcelain-test-1[\s\S]*\nindex suffix\n$/,
  );
  const initial = snapshot(root);
  assert.match(
    read(root, pageDir + "/porcelain-test-1.tsx"),
    /Future body sentinel for week 1\./,
  );
  assert.doesNotMatch(
    Object.values(initial).join("\n"),
    /Future body sentinel for week 2\.|porcelain-test-2/,
  );
  assert.equal(materialize({ root, queue, now: new Date(first) }).written, 0);
  assert.deepEqual(snapshot(root), initial);

  assert.equal(
    materialize({ root, queue, now: new Date(second) }).published,
    2,
  );
  assert.deepEqual(fs.readdirSync(path.join(root, pageDir)), [
    "porcelain-test-1.tsx",
    "porcelain-test-2.tsx",
  ]);
});

test("fails closed for malformed data and duplicate identifiers before any writes", (t) => {
  const { materialize } = publisher();
  const root = fixture(t);
  const before = snapshot(root);
  for (const [field, invalid, message] of [
    ["publishAt", "2027-02-30T14:00:00Z", /publishAt/],
    ["publishAt", "2026-11-09T13:00:00Z", /publishAt/],
    ["date", "2026-11-08", /date/],
    ["slug", "../bad", /slug/],
    ["audience", "unknown", /audience/],
    ["title", "", /title/],
    ["markdown", "Missing heading and body", /markdown/],
    ["heroImage", "https://example.test/image.jpg", /heroImage/],
    ["week", 1, /duplicate week/i],
    ["slug", queue.entries[0].slug, /duplicate slug/i],
  ]) {
    const malformed = structuredClone(queue);
    malformed.entries[1][field] = invalid;
    assert.throws(
      () => materialize({ root, queue: malformed, now: new Date(first) }),
      message,
    );
    assert.deepEqual(snapshot(root), before);
    assert.equal(fs.existsSync(path.join(root, pageDir)), false);
  }
  assert.throws(
    () =>
      materialize({
        root,
        queue: { ...queue, entries: queue.entries.slice(0, 51) },
        now: new Date(first),
      }),
    /52 entries/,
  );
});

test("validates the last future entry before selecting, dispatching or writing", (t) => {
  const { materialize, selectDueEntries, shouldDispatch } = publisher();
  const malformed = structuredClone(queue);
  malformed.entries.at(-1).seoTitle = "";
  const now = new Date(first);
  assert.throws(
    () => selectDueEntries(malformed, now),
    /entry 52: invalid seoTitle/,
  );
  assert.throws(
    () => shouldDispatch(malformed, now),
    /entry 52: invalid seoTitle/,
  );

  const root = fixture(t);
  const before = snapshot(root);
  assert.throws(
    () => materialize({ root, queue: malformed, now }),
    /entry 52: invalid seoTitle/,
  );
  assert.deepEqual(snapshot(root), before);
  assert.equal(fs.existsSync(path.join(root, pageDir)), false);
});

test("rejects future slug collisions in unrelated routes or index and files", (t) => {
  const { materialize } = publisher();
  const roots = [
    fixture(t, '  route("resources/porcelain-test-2", "pages/Other.tsx"),\n'),
    fixture(t, "", '  { slug: "porcelain-test-2" },\n'),
    fixture(t, "", '  { "slug": "porcelain-test-2" },\n'),
    fixture(
      t,
      '  route("something-else", "pages/blog/porcelain-scheduled/porcelain-test-2.tsx"),\n',
    ),
    fixture(t),
    fixture(t),
  ];
  fs.mkdirSync(path.join(roots[4], pageDir));
  fs.writeFileSync(
    path.join(roots[4], pageDir, "porcelain-test-2.tsx"),
    "unowned page",
  );
  fs.writeFileSync(
    path.join(roots[5], "src/pages/blog/PorcelainTest2.tsx"),
    "unowned page",
  );
  for (const root of roots) {
    const before = snapshot(root);
    assert.throws(
      () => materialize({ root, queue, now: new Date(first) }),
      /collision/i,
    );
    assert.deepEqual(snapshot(root), before);
  }
});

test("refuses stale owned output and leaves the prior materialization intact", (t) => {
  const { materialize } = publisher();
  const root = fixture(t);
  materialize({ root, queue, now: new Date(second) });
  const before = snapshot(root);
  assert.throws(
    () => materialize({ root, queue, now: new Date(first) }),
    /stale/i,
  );
  assert.deepEqual(snapshot(root), before);
});

test("preserves CRLF and refuses invalid markers without writing a page", (t) => {
  const { materialize } = publisher();
  const root = fixture(t);
  for (const file of [routeFile, indexFile]) {
    fs.writeFileSync(
      path.join(root, file),
      read(root, file).replaceAll("\n", "\r\n"),
    );
  }
  materialize({ root, queue, now: new Date(first) });
  for (const file of [routeFile, indexFile]) {
    assert.doesNotMatch(read(root, file), /(?<!\r)\n/);
  }

  const missingRoot = fixture(t);
  fs.writeFileSync(path.join(missingRoot, indexFile), "existing index\n");
  const missingBefore = snapshot(missingRoot);
  assert.throws(
    () => materialize({ root: missingRoot, queue, now: new Date(first) }),
    /markers/i,
  );
  assert.deepEqual(snapshot(missingRoot), missingBefore);

  const brokenRoot = fixture(t, marker);
  const before = snapshot(brokenRoot);
  assert.throws(
    () => materialize({ root: brokenRoot, queue, now: new Date(first) }),
    /markers/i,
  );
  assert.deepEqual(snapshot(brokenRoot), before);
});

test("renders supported Markdown with JSX-safe text, fixed tags and safe link attributes", () => {
  const { renderArticle } = publisher();
  const entry = {
    ...queue.entries[0],
    title: 'Title "{literal}"',
    markdown: [
      "# Layout owns this title",
      "",
      "## Heading",
      "A {braced} <script>alert(1)</script> **strong** *emphasis* _also emphasized_.",
      "",
      "### Subheading",
      "- List item",
      "- Another item",
      "",
      "1. First ordered item",
      "2. Second ordered item",
      "",
      "[Local](/contact?service=porcelain&audience=trade) [Source](https://example.test/a_(guide).pdf)",
      "[Blocked](javascript:alert(1)) [Data](data:text/html,x) [Bad host](//example.test) [Escape](/\\evil.test)",
      "![Untrusted image](https://example.test/tracker.gif)",
    ].join("\n"),
  };
  const source = renderArticle(entry);
  assert.match(source, /title=\{"Title \\"\{literal\}\\""\}/);
  assert.doesNotMatch(
    source,
    /Layout owns this title|<h1|<script|<img|dangerouslySetInnerHTML/,
  );
  for (const element of ["h2", "h3", "ul", "ol", "li", "strong", "em"])
    assert.ok(source.includes("<" + element + ">"));
  assert.ok(
    source.includes('href={"/contact?service=porcelain&audience=trade"}'),
  );
  assert.ok(source.includes('href={"https://example.test/a_(guide).pdf"}'));
  assert.doesNotMatch(source, /href=\{"(?:javascript:|data:|\/\/|\/\\\\)/i);
});

test("records one dispatch request per due week while allowing a same-week retry", () => {
  const { planDispatch } = publisher();
  const weekOne = planDispatch(queue, new Date(first), null);
  assert.deepEqual(weekOne, {
    dispatch: true,
    receipt: {
      week: 1,
      date: "2026-11-07",
      requestedAt: "2026-11-07T05:00:00.000Z",
    },
  });
  const retry = planDispatch(
    queue,
    new Date("2026-11-07T15:30:00Z"),
    weekOne.receipt,
  );
  assert.deepEqual(retry, { dispatch: true, receipt: null });

  const weekTwo = planDispatch(
    queue,
    new Date("2026-11-09T14:30:00Z"),
    weekOne.receipt,
  );
  assert.deepEqual(weekTwo, {
    dispatch: true,
    receipt: {
      week: 2,
      date: "2026-11-09",
      requestedAt: "2026-11-09T14:30:00.000Z",
    },
  });
  assert.deepEqual(
    planDispatch(queue, new Date("2026-11-09T13:59:59Z"), weekOne.receipt),
    { dispatch: false, receipt: null },
  );
  assert.deepEqual(
    planDispatch(queue, new Date("2027-11-01T04:00:00Z"), weekTwo.receipt),
    { dispatch: false, receipt: null },
  );
});

test("refuses to replace a malformed or newer dispatch receipt", () => {
  const { planDispatch } = publisher();
  for (const receipt of [
    {},
    { week: 1, date: "2026-11-07", requestedAt: "yesterday" },
    { week: 1, date: "2026-11-08", requestedAt: "2026-11-07T05:00:00.000Z" },
    { week: 2, date: "2026-11-09", requestedAt: "2026-11-09T14:00:00.000Z" },
  ]) {
    assert.throws(
      () => planDispatch(queue, new Date(first), receipt),
      /dispatch receipt/i,
    );
  }
});
