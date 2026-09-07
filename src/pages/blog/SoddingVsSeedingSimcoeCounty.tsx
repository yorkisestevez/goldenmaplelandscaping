import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';

export default function SoddingVsSeedingSimcoeCounty() {
  const faqSchema = {
      "@type": "FAQPage",
      "mainEntity": [
          {
              "@type": "Question",
              "name": "How much does sod installation cost in Barrie, Ontario?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Installed sod in Barrie and Simcoe County runs $1.20–$2.50 per square foot all-in, including topsoil prep, labour, and delivery. A 1,000 sq ft backyard project typically costs $1,200–$2,500. The biggest variable is how much topsoil prep is needed — new build sites often require 4–6 inches of screened topsoil before sod goes down, adding $0.40–$0.80 per sq ft to the base quote."
              }
          },
          {
              "@type": "Question",
              "name": "Is it cheaper to seed or sod a new lawn?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Seeding costs $0.25–$0.65 per square foot installed versus $1.20–$2.50 for sod, so seed is 3–5x cheaper in materials and labour. However, seed requires equal topsoil prep, takes 8–16 weeks to establish, and has a higher year-one failure risk on slopes or if watering is inconsistent. For large, flat sites with good timing, seeding can save thousands. For small yards, sloped yards, or tight timelines, sod's reliability often makes it better value."
              }
          },
          {
              "@type": "Question",
              "name": "When is the best time to lay sod in Simcoe County?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "May through mid-October is the installation window for sod in Simcoe County. The ideal window is May–June (roots establish through summer) or August–September (cooler temperatures reduce water stress). Avoid installing sod after mid-October — there is not enough soil warmth left for roots to knit before freeze-up, which leads to frost heave and uneven turf by spring."
              }
          },
          {
              "@type": "Question",
              "name": "When is the best time to seed a lawn in Barrie?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "August 15 to September 15 is the prime seeding window in Barrie. Soil is still warm enough to germinate seed (above 8°C), air temperatures are dropping, and late summer moisture is more reliable than in July. Spring seeding from May 1 onward works as a second-best option. Seeding in October or July has a significantly higher failure rate in our climate."
              }
          },
          {
              "@type": "Question",
              "name": "Do I need topsoil before laying sod or seeding?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Yes, 4–6 inches of screened topsoil is needed before both sod and seeding on most Barrie properties. New build sites in particular are often left with compacted clay subgrade and 1–2 inches of fill — not enough for grass roots to establish properly. Skipping topsoil is the single most common reason new lawns fail within 2 years, regardless of which installation method was used."
              }
          },
          {
              "@type": "Question",
              "name": "How long does it take for sod to root in Ontario?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Sod typically begins rooting within 10–14 days and is strong enough for light foot traffic by week 3. Full establishment — where the sod is firmly knit to the topsoil and can handle regular use — takes 6–8 weeks. During that establishment period, daily watering for the first 2 weeks is critical, particularly in summer installations."
              }
          },
          {
              "@type": "Question",
              "name": "Can you seed over bare clay soil without adding topsoil?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Technically yes, but the results are usually poor. Barrie's clay soil compacts easily and drains slowly, which creates a wet, anaerobic root zone that grass struggles in. Without 4 inches of screened topsoil to work into, seed germination is uneven and the lawn will likely need overseeding after the first season. The topsoil cost is unavoidable if you want a lawn that lasts more than 2–3 years."
              }
          },
          {
              "@type": "Question",
              "name": "Is sod worth the extra cost compared to seeding?",
              "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "For most residential yards in Simcoe County, yes — particularly for yards under 2,000 sq ft or any yard with a slope. The faster timeline (usable in 3–4 weeks vs 8–16 weeks), lower year-one failure risk, and slope stability make sod worth the premium for the majority of homeowners. Seeding becomes genuinely competitive on large, flat sites where the Aug–Sep timing aligns and budget is the primary constraint."
              }
          }
      ]
  };

  return (
    <BlogPostLayout
      title="Sod vs. Seed in Simcoe County: Real Cost & Timeline for a New Lawn"
      seoTitle="Sod vs. Seed Simcoe County: Cost & Timeline 2026"
      seoDescription="Sodding a new lawn in Simcoe County runs $1.20–$2.50 per sq ft installed; seeding costs $0.25–$0.65 per sq ft but takes 8–16 weeks to establish."
      category="Materials"
      date="September 7, 2026"
      readTime="10 min"
      heroImage="/images/projects/rendering1.jpg"
      schema={faqSchema}
      tldr="Sodding a new lawn in Simcoe County typically costs $1.20–$2.50 per square foot installed, and gives you a usable surface within 3–4 weeks. Seeding runs $0.25–$0.65 per square foot but takes 8–16 weeks before the lawn can handle foot traffic. Sod wins on speed and slope stability; seeding wins on budget and species variety. Clay-heavy Barrie soils make proper topsoil prep the deciding factor for either method."
      keywords="Sod vs. Seed Simcoe County: Cost & Timeline 2026"
      wordCount={2832}
    >
      <div className="not-prose mb-12 p-7 rounded-2xl border border-brand-gold/30 bg-gradient-to-b from-brand-gold/[0.08] to-transparent">
        <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-3">Quick Answer</div>
        <p className="font-sans text-base text-brand-bonewhite font-light leading-relaxed mb-0">Sodding a new lawn in Simcoe County typically costs $1.20–$2.50 per square foot installed, and gives you a usable surface within 3–4 weeks. Seeding runs $0.25–$0.65 per square foot but takes 8–16 weeks before the lawn can handle foot traffic. Sod wins on speed and slope stability; seeding wins on budget and species variety. Clay-heavy Barrie soils make proper topsoil prep the deciding factor for either method.</p>
      </div>

      <div dangerouslySetInnerHTML={{ __html: "<p>Every spring we get calls from Simcoe County homeowners who just finished a new build, an addition, or a backyard renovation and are staring at bare dirt or compacted subsoil. The first question is always the same: should we sod or seed? It sounds like a simple trade-off, but in Barrie and the surrounding townships it is anything but simple — soil type, slope, how fast you need the yard usable, and what the project cost envelope looks like all pull in different directions.</p><p>What we find in practice is that seeding quotes often look attractive until the homeowner realises the timeline is measured in months, not weeks. And sod quotes look alarming until you factor in that a well-installed sod job lets you use the yard in under a month, stays in place on slopes where seed would wash away in the first rain, and costs far less to maintain in year one. Neither approach is universally better — the right answer depends on your specific yard, your timeline, and how much prep you are willing to do under either option.</p><p>Below we walk through exactly what each method costs in Simcoe County today, what drives the variance, and which conditions make one the clear winner over the other. We cover soil prep (the part most contractors underquote), realistic success timelines in our climate, and a few common mistakes that turn a $3,000 lawn project into a $6,000 redo.</p>" }} />

      <h2>What Does Sod Actually Cost in Simcoe County?</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>Installed sod in Simcoe County runs <strong>$1.20–$2.50 per square foot</strong> all-in — that range accounts for access difficulty, topsoil depth needed, and whether the grade needs correcting first. A typical 400 sq ft backyard project lands between $480 and $1,000; a 2,000 sq ft full yard (front + back) is more realistically $2,400–$5,000 once prep, delivery, and labour are included. Supply-chain variability in 2026 has kept sod pallets from the Barrie-area nurseries in the $0.50–$0.90 per sq ft range at the farm gate, but that is not what you pay once it is in the ground.</p><p>The biggest cost driver after raw sod price is <strong>topsoil depth</strong>. On new builds around Barrie — particularly in the south-end and Innisfil subdivisions where builders strip the site to subgrade — there is often zero workable topsoil. Installing sod over compacted clay subsoil gives you maybe one growing season before roots suffocate and bare patches appear. We typically bring in 4 inches of topsoil minimum before sod goes down; on problem sites we use 6 inches. That is roughly $0.30–$0.60 per sq ft added to the budget, which is why \"cheap sod\" quotes that skip the topsoil conversation are usually not cheap at all over a 3-year window.</p><p>Grade correction and drainage prep compound the cost further. If your yard slopes toward the house, or sits lower than neighbouring properties, we address those issues before sod installation — a properly graded surface sheds water at roughly 2% slope away from the foundation. Regrading adds $0.15–$0.45 per sq ft depending on how much material needs to move. None of this is optional; it is what separates a lawn that lasts from one that needs replacing.</p><p>Watering infrastructure also belongs in the budget. New sod needs water twice daily for the first 2 weeks, then daily for another 2 weeks. If you are connecting a temporary hose or renting a sprinkler setup, that cost is yours; if you have us schedule the install and you are travelling or at work all day, factor in who is actually doing the watering or the sod fails regardless of how well we installed it.</p>" }} />

      <h2>What Does Seeding Cost — and What Are You Actually Buying?</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>Seeding a lawn in Simcoe County costs <strong>$0.25–$0.65 per square foot</strong> installed, which works out to roughly $100–$260 for a 400 sq ft space or $500–$1,300 for 2,000 sq ft. That gap between sod and seed pricing is real, but it narrows considerably once you add the topsoil prep that seeding also needs, the time cost of watering through germination, and the near-certainty of overseeding bare patches at least once in year one.</p><p>What you are buying with seeding is more species flexibility. We can dial in a <strong>Kentucky bluegrass, creeping red fescue, or perennial ryegrass blend</strong> to match your exact combination of sun, shade, and traffic. For north-facing yards with afternoon shade — common in older Barrie neighbourhoods east of Bayfield Street — a fine fescue mix outperforms standard contractor sod blends that are tuned for full sun. That flexibility matters for long-term lawn quality even if it costs patience up front.</p><p>Seeding also allows the grass to develop deep, natural root structure from the start rather than rooting through an added sod layer. On well-prepped soil, a seeded lawn is genuinely more drought-resilient by year two. The caveat is that Simcoe County has a relatively short establishment window: seeding works best in late August through mid-September (soil is warm, air is cooling, moisture is more reliable) or in May through early June. Miss that window and germination rates drop, which means patchy coverage and the extra cost of fall overseeding.</p><p>The honest downside is slope. On any grade above roughly 3:1 (a 33% incline), seed washes in the first heavy rain — and Barrie can get 40–60mm rainfall events from Lake Simcoe weather systems in spring. Below 3:1 on flat terrain, seed is a legitimate budget option. Above that, sod is not a luxury; it is the practical choice. We have seen homeowners spend $800 on seed and straw for a sloped yard, lose most of it in one rain event, and then spend $2,000 on sod six weeks later.</p>" }} />

      <h2>How Ontario's Freeze-Thaw Cycle Changes the Calculation</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>Simcoe County averages 45–55 freeze-thaw cycles per year — the ground near Barrie and Lake Simcoe can move through 0°C dozens of times each winter. This affects both seeding and sodding outcomes in ways that homeowners from milder climates do not always anticipate. For sod, the risk is <em>frost heave</em>: if sod is installed too late in fall (after mid-October in our area) without adequate root establishment, the roots that have not yet knit into topsoil can be lifted by frost, creating uneven, bumpy turf by spring. A sod installation in September still has 6–8 weeks of soil temperatures above 5°C to knit roots; an October install often does not.</p><p>For seed, the concern is <em>timing precision</em>. An August 15 to September 15 seeding window gives germinating grass 6–8 weeks to build enough root mass to survive the first frost and winter dormancy. Seed sown after September 20 in the Barrie area is gambling — the seedlings may not harden off in time. Spring seeding after May 1 works, but you are establishing grass through June heat stress and then asking it to hold through July and August with supplemental watering.</p><p>Barrie's clay-dominant soil also stays cold longer in spring than the sandy-loam soils you find further south. Soil temperatures in low-lying areas around Kempenfelt Bay do not reliably hit 8°C — the minimum for Kentucky bluegrass germination — until mid-May in most years. Seeding before that threshold means poor germination and wasted seed. We use a soil thermometer before any seeding, not a calendar date. A $12 thermometer prevents a $400 seeding job from being redone.</p><p>In short: if your project wraps up in August or September, either method can work with proper timing. If your yard is bare by October or June, sod is the more reliable path to a lawn before winter or before summer heat. Seed is most competitive when your schedule lines up with the ideal fall window.</p>" }} />

      <h2>Soil Prep: The Step Both Methods Depend On</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>We will say this plainly: <strong>soil preparation costs more than people expect and matters more than people realise</strong>. The most common reason a new lawn fails — whether sodded or seeded — is that the prep was skipped or underspec'd. On new construction sites in Barrie and Innisfil, builders compact the subgrade for machinery access and then leave 1–2 inches of fill at best. That is not a growing medium; it is a shell. Grass roots need 4–6 inches of fertile, aerated topsoil to establish properly.</p><p>For a standard residential project, our soil prep sequence looks like this:</p><ul><li>Rough grade the subsoil to establish drainage slope (2% minimum away from structures)</li><li>Rototill or scarify the subsoil surface to 3–4 inches to prevent a hard interface layer</li><li>Apply 4 inches of screened topsoil (or 6 inches on problem sites), raked level</li><li>Incorporate starter fertiliser — typically a 10-20-10 NPK blend at 2–3 lbs per 1,000 sq ft</li><li>Roll lightly to firm the surface before sod or seed goes down</li></ul><p>This prep runs <strong>$0.40–$0.80 per square foot</strong> depending on topsoil source and travel, and it applies equally to sodded and seeded projects. Contractors who skip the topsoil or use fill instead of screened topsoil are cutting corners that show up within 2 years. At Carr Landscape Depot in Barrie, screened topsoil currently runs about $40–$55 per yard delivered; a 2,000 sq ft yard needs roughly 25–30 yards of topsoil at 4 inches depth.</p><p>One additional prep element that differs between methods: seeding requires the topsoil surface to be lightly raked to create a fine, even seedbed with good seed-to-soil contact. Sod requires a firmer, more level surface since you are laying rolls that need even support underneath to prevent air pockets. Neither is particularly difficult, but they require different finishing techniques and different time windows between prep and installation.</p>" }} />

      <h2>Timeline: When Will You Actually Be Using the Yard?</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>For most Simcoe County homeowners, timeline is the practical tiebreaker. Sod can be walked on lightly after <strong>3 weeks</strong> and is fully established — meaning mowable, playable, and traffic-tolerant — within <strong>6–8 weeks</strong> of installation in good growing conditions. That timeline assumes daily watering for the first 2 weeks and alternate-day watering for weeks 3 and 4. Skip the watering schedule and you are looking at dead patches within 10 days in summer heat.</p><p>Seed is slower by design. Germination takes 7–21 days depending on species and soil temperature. Kentucky bluegrass is on the slow end (14–21 days); perennial ryegrass is faster (7–10 days). But germination is not establishment. A seeded lawn should not see foot traffic for at least 8 weeks, and full establishment — where the root system is dense enough to handle a Barrie summer without irrigation — takes 12–16 weeks or one full growing season.</p><p>The practical timeline question is: when does your project finish, and when do you need the lawn? If you are finishing a backyard renovation in late July and have a September outdoor event, sod is the only realistic option. If you finish in September and are patient through next spring, seeding in early September gives you a strong, well-rooted lawn by the following June.</p><p>For families with young children or pets, sod's faster establishment is often worth the premium on its own. We have had clients seed in hopes of saving $1,500 and then spend the following summer roping off a muddy yard while the lawn patches filled in. That story does not end well for anyone.</p>" }} />

      <h2>Which Method Is Right for Your Barrie Property?</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>After 5+ years of landscape installations across Barrie, Innisfil, Oro-Medonte, and Springwater, the pattern we see is fairly consistent. Sod is the right call in most residential situations — not because it is always better agronomically, but because it performs reliably across the widest range of conditions. Seed is the right call when budget is the primary constraint, timing aligns with the ideal fall window, and the site is flat or nearly flat.</p><p>Here is a quick decision framework based on what actually plays out on real projects:</p><ul><li><strong>New construction site with compacted subgrade:</strong> Sod every time — the controlled roll gives you a clean start and a usable yard sooner</li><li><strong>Overseeding thin lawn areas:</strong> Seed is ideal — no need to remove existing grass, and fall overseeding costs as little as $0.10–$0.20 per sq ft in materials</li><li><strong>Slope above 15% grade:</strong> Sod with jute mesh on steep sections — seed does not hold</li><li><strong>Shaded north-facing yard:</strong> Seeding with a shade-tolerant fescue blend outperforms standard sod in year two</li><li><strong>Large open area, flat, fall timing:</strong> Seeding can save $3,000–$8,000 on large lots and is worth the patience</li><li><strong>Yard needed for summer season:</strong> Sod installed by late May or early June is the only realistic path</li></ul><p>The decision rarely comes down to one factor. We always walk the site, look at the soil, confirm the timeline, and give an honest recommendation. We are not in the business of selling sod to everyone — sometimes the smartest move for the client is the cheaper seeded option with good prep. If you want a realistic assessment for your <a href='/locations/barrie'>Barrie</a> or Simcoe County property, the starting point is a site visit, not a price-per-square-foot comparison.</p>" }} />

      <div className="not-prose my-10 overflow-x-auto">
        <p className="font-sans text-[11px] uppercase tracking-widest text-brand-gold mb-3">Sod vs. seeding comparison for Simcoe County lawns — 2026 installed pricing</p>
        <div dangerouslySetInnerHTML={{ __html: "<table><thead><tr><th>Factor</th><th>Sod</th><th>Seeding</th></tr></thead><tbody><tr><td>Installed cost (per sq ft)</td><td>$1.20–$2.50</td><td>$0.25–$0.65</td></tr><tr><td>Topsoil prep needed</td><td>4–6 inches (same)</td><td>4–6 inches (same)</td></tr><tr><td>Usable after installation</td><td>3–4 weeks</td><td>8–16 weeks</td></tr><tr><td>Slope performance</td><td>Excellent — holds on grades up to 40%</td><td>Washes on grades above ~15%</td></tr><tr><td>Ideal timing (Barrie)</td><td>May–Oct (avoid after Oct 15)</td><td>Aug 15 – Sep 15 or May–early Jun</td></tr><tr><td>Grass species flexibility</td><td>Limited to nursery blends</td><td>Full blend customisation</td></tr><tr><td>Root depth at year 2</td><td>Same as seed if prep is equal</td><td>Slightly deeper natural root structure</td></tr><tr><td>Year-1 failure risk</td><td>Low with watering</td><td>Moderate — timing and watering critical</td></tr></tbody></table>" }} />
      </div>

      <h2>Frequently Asked Questions</h2>
      <div className="mt-8">
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">How much does sod installation cost in Barrie, Ontario?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Installed sod in Barrie and Simcoe County runs $1.20–$2.50 per square foot all-in, including topsoil prep, labour, and delivery. A 1,000 sq ft backyard project typically costs $1,200–$2,500. The biggest variable is how much topsoil prep is needed — new build sites often require 4–6 inches of screened topsoil before sod goes down, adding $0.40–$0.80 per sq ft to the base quote.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">Is it cheaper to seed or sod a new lawn?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Seeding costs $0.25–$0.65 per square foot installed versus $1.20–$2.50 for sod, so seed is 3–5x cheaper in materials and labour. However, seed requires equal topsoil prep, takes 8–16 weeks to establish, and has a higher year-one failure risk on slopes or if watering is inconsistent. For large, flat sites with good timing, seeding can save thousands. For small yards, sloped yards, or tight timelines, sod's reliability often makes it better value.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">When is the best time to lay sod in Simcoe County?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>May through mid-October is the installation window for sod in Simcoe County. The ideal window is May–June (roots establish through summer) or August–September (cooler temperatures reduce water stress). Avoid installing sod after mid-October — there is not enough soil warmth left for roots to knit before freeze-up, which leads to frost heave and uneven turf by spring.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">When is the best time to seed a lawn in Barrie?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>August 15 to September 15 is the prime seeding window in Barrie. Soil is still warm enough to germinate seed (above 8°C), air temperatures are dropping, and late summer moisture is more reliable than in July. Spring seeding from May 1 onward works as a second-best option. Seeding in October or July has a significantly higher failure rate in our climate.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">Do I need topsoil before laying sod or seeding?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Yes, 4–6 inches of screened topsoil is needed before both sod and seeding on most Barrie properties. New build sites in particular are often left with compacted clay subgrade and 1–2 inches of fill — not enough for grass roots to establish properly. Skipping topsoil is the single most common reason new lawns fail within 2 years, regardless of which installation method was used.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">How long does it take for sod to root in Ontario?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Sod typically begins rooting within 10–14 days and is strong enough for light foot traffic by week 3. Full establishment — where the sod is firmly knit to the topsoil and can handle regular use — takes 6–8 weeks. During that establishment period, daily watering for the first 2 weeks is critical, particularly in summer installations.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">Can you seed over bare clay soil without adding topsoil?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Technically yes, but the results are usually poor. Barrie's clay soil compacts easily and drains slowly, which creates a wet, anaerobic root zone that grass struggles in. Without 4 inches of screened topsoil to work into, seed germination is uneven and the lawn will likely need overseeding after the first season. The topsoil cost is unavoidable if you want a lawn that lasts more than 2–3 years.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">Is sod worth the extra cost compared to seeding?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>For most residential yards in Simcoe County, yes — particularly for yards under 2,000 sq ft or any yard with a slope. The faster timeline (usable in 3–4 weeks vs 8–16 weeks), lower year-one failure risk, and slope stability make sod worth the premium for the majority of homeowners. Seeding becomes genuinely competitive on large, flat sites where the Aug–Sep timing aligns and budget is the primary constraint.</p>" }} />
        </div>
      </div>

      <AuthorBio bio={"Yorkis Estevez founded Golden Maple Landscaping in 2020 and has been installing lawns, patios, and outdoor spaces across Simcoe County ever since. The company is WSIB certified, carries $5M in liability coverage, and holds a 5.0 Google rating across all verified reviews. Yorkis writes from field experience, not theory."} />

      <div dangerouslySetInnerHTML={{ __html: "<p>If your Barrie or Simcoe County property needs a new lawn — whether you are coming off a new build, a major renovation, or years of bare patches — we are happy to walk the site and give you a straight answer on sod vs. seed with no upsell pressure. <a href='/services/landscape-design-barrie'>Our landscape design service</a> covers full lawn installation as well as hardscape, and we can sequence the work so everything is done in the right order. <a href='/contact'>Reach out through our contact page</a> to book a site visit, or use our <a href='/cost-estimator'>project cost estimator</a> to get a ballpark number before we talk.</p>" }} />
    </BlogPostLayout>
  );
}
