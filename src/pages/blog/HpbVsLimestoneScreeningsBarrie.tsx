import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';

export default function HpbVsLimestoneScreeningsBarrie() {
  const faqSchema = {
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is HPB bedding for pavers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "HPB (High Performance Bedding) is a 3/8-inch washed, angular clear limestone with no fine particles. It is screeded in a strict 1-inch layer directly under interlocking pavers. Because it contains no fines, water passes straight through instead of pooling, which makes it the preferred bedding in Barrie's clay soils and freeze-thaw winters."
        }
      },
      {
        "@type": "Question",
        "name": "Will limestone screenings damage my pavers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Screenings do not chemically damage pavers, but their fine dust holds water. In Barrie clay that water has nowhere to go, so it freezes and expands through the winter, nudging pavers out of level. Screenings also raise the odds of efflorescence — the white calcium haze that blooms on paver surfaces — because moisture migrating through limestone fines carries dissolved salts to the surface."
        }
      },
      {
        "@type": "Question",
        "name": "How thick should the bedding layer be under interlocking pavers?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Exactly 1 inch (25 mm), screeded level. A bedding layer thicker than 1.5 inches is a common DIY failure: the loose material never fully locks up, and foot traffic plus freeze-thaw compacts it unevenly, leaving waves and dips within 1–2 winters. If you need to make up elevation, add it to the compacted clear-stone base below, never to the bedding."
        }
      },
      {
        "@type": "Question",
        "name": "Does the bedding choice matter if I use polymeric sand in the joints?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes — they work as a team. Polymeric sand locks the joints against weeds and ants, but it is not a waterproof membrane. Water still enters through joints and drains downward. If the bedding is screenings that hold water, the base stays wet; if it is HPB, water keeps moving through the 1-inch bedding into the clear-stone base below. Good jointing sand cannot rescue a soggy bedding layer."
        }
      },
      {
        "@type": "Question",
        "name": "Which is cheaper: HPB or limestone screenings in Barrie?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Screenings are the cheaper material per tonne at most Barrie-area quarries, but the saving is small in context: a 400 sq ft patio needs roughly 1.6 tonnes of bedding, so the material difference is measured in the low hundreds of dollars against a project worth many thousands. A relay caused by a failed bedding layer costs far more than HPB ever saves upfront."
        }
      },
      {
        "@type": "Question",
        "name": "How deep should the base be under an interlocking patio in Barrie?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "For patios and walkways, 6–10 inches of compacted clear stone; for driveways that carry vehicles, 12–16 inches of compacted clear stone — never granular A. In Barrie, we also separate the base from clay subsoil with a geotextile fabric so fine clay cannot migrate upward into the stone over time. For a full breakdown of base options, see our guide to clear stone vs. granular A."
        }
      }
    ]
  };

  return (
    <BlogPostLayout
      title="HPB vs Limestone Screenings: What Belongs Under Your Pavers in Barrie"
      seoTitle="HPB vs Limestone Screenings: Barrie Paver Guide"
      seoDescription="HPB vs limestone screenings under pavers in Barrie: 3/8-inch clear HPB drains through a 1-inch bedding layer; screenings hold water and heave on clay."
      category="Engineering"
      date="September 28, 2026"
      readTime="10 min"
      heroImage="/images/projects/paver-driveway.JPG"
      schema={faqSchema}
      tldr="For Barrie interlocking patios and driveways, HPB (3/8-inch washed, angular clear limestone) is the better bedding than limestone screenings. HPB contains no fines, so water drains straight through its 1-inch screeded layer instead of pooling. Screenings hold moisture in their fine dust, which freezes and expands on Barrie's clay subsoils — the classic cause of pavers that heave in winter and never settle back level in spring."
      keywords="HPB vs limestone screenings, golden maple landscaping, Barrie landscaping"
      wordCount={1893}
    >
      <div className="not-prose mb-12 p-7 rounded-2xl border border-brand-gold/30 bg-gradient-to-b from-brand-gold/[0.08] to-transparent">
        <div className="font-sans text-[10px] uppercase tracking-[0.3em] text-brand-gold mb-3">Quick Answer</div>
        <p className="font-sans text-base text-brand-bonewhite font-light leading-relaxed mb-0">For Barrie interlocking patios and driveways, HPB (3/8-inch washed, angular clear limestone) is the better bedding than limestone screenings. HPB contains no fines, so water drains straight through its 1-inch screeded layer instead of pooling. Screenings hold moisture in their fine dust, which freezes and expands on Barrie's clay subsoils — the classic cause of pavers that heave in winter and never settle back level in spring.</p>
      </div>

      <div dangerouslySetInnerHTML={{ __html: "<p>Ask three contractors what goes directly under interlocking pavers and you may get three answers — but on this one the industry has largely settled. For decades, limestone screenings were the default bedding across Ontario: cheap, easy to screed, and forgiving to work with. Then crews started pulling up patios in Barrie after 5–8 years and finding the same story underneath — screenings turned to soup by October, frozen solid by January, and pavers riding an uneven wave by March.</p><p>HPB — High Performance Bedding — is the answer most reputable Simcoe County contractors have moved to. It is a 3/8-inch washed, angular crushed limestone with zero fine particles. It costs a little more per tonne than screenings, screeds slightly slower, and repays both investments the first winter. Here is exactly how the two compare, and what Barrie&#39;s clay soil and freeze-thaw cycles mean for your choice.</p>" }} />

      <h2>What Each Material Actually Is</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p><strong>HPB</strong> is a manufactured aggregate: limestone crushed to a nominal 3/8-inch size, washed to remove dust, and screened so that essentially no fines remain. Each piece is angular, so the stones mechanically lock together while the void space between them — roughly 40% of the volume — stays open for water to pass through. You screed it 1 inch thick, set the pavers, compact once, and it locks into a free-draining layer.</p><p><strong>Limestone screenings</strong> are the fine end of the same crushing process: 3/16-inch-minus material that includes a large fraction of stone dust and fines. That dust is exactly what makes screenings pleasant to screed — it acts like a paste that lets you pull a perfectly smooth bed. It is also what makes them hold water. A screeded layer of screenings behaves like a dense, nearly impermeable mat once it is wet: water sits in it rather than draining through it.</p><p>The confusion usually comes from mixing up <em>bedding</em> and <em>base</em>. The bedding is the final 1-inch levelling layer the pavers sit in. The base is the 6–16 inches of compacted clear stone underneath that carries the load. Screenings were historically used as bedding because they screed beautifully — not because they drain well. If you want the full picture of what goes deeper, read our <a href=\"/resources/clear-stone-vs-granular-a-base\">clear stone vs. granular A base guide</a>.</p>" }} />

      <h2>Why Barrie's Ground Makes This Choice More Serious</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>Barrie sits on clay-heavy subsoil — silty clay across much of the city, with sandier pockets only near the Lake Simcoe shoreline. Clay drains at a fraction of the rate of loam or sand, which means the subsoil under your patio is effectively a bathtub bottom. Any water that reaches it sits there, and in a Barrie winter that water freezes: frost drives roughly 4 feet — about 1.2 metres — into the ground, and every freeze-thaw cycle moves whatever is saturated.</p><p>This is the exact scenario where screenings fail. Water enters through the paver joints — polymeric sand reduces weed and ant intrusion but is not waterproof — and soaks into the screenings layer. The fines hold it. The layer freezes and expands upward, lifting pavers; when it thaws, the fines settle into a slightly different arrangement than before. Repeat that dozens of times per winter and the surface never returns to where it started. HPB breaks the cycle at the first step: water passes through the bedding into the <a href=\"/services/interlocking-barrie\">compacted clear-stone base</a> below, where it keeps moving downward instead of freezing in place.</p><p>There is a second, cosmetic reason. Screenings are made of limestone fines, and water moving through them carries dissolved calcium salts upward. When that moisture evaporates at the paver surface, it leaves the white, chalky bloom called efflorescence — one of the most common complaints on new interlock. Washed HPB contains far less soluble dust, so the efflorescence risk drops with it. Efflorescence usually weathers off within a season or two, but nobody wants to stare at a hazy patio while it does.</p>" }} />

      <h2>Head-to-Head: HPB vs Limestone Screenings</h2>
      <div dangerouslySetInnerHTML={{ __html: "<table class=\"w-full text-sm mb-8\"><thead><tr class=\"border-b border-brand-gold/30\"><th class=\"text-left py-3 pr-4 font-sans text-brand-gold uppercase tracking-wider text-xs\">Factor</th><th class=\"text-left py-3 pr-4 font-sans text-brand-gold uppercase tracking-wider text-xs\">HPB (3/8-inch clear)</th><th class=\"text-left py-3 font-sans text-brand-gold uppercase tracking-wider text-xs\">Limestone screenings</th></tr></thead><tbody class=\"font-sans text-brand-bonewhite/90 font-light\"><tr class=\"border-b border-brand-bonewhite/10\"><td class=\"py-3 pr-4 font-medium\">Drainage</td><td class=\"py-3 pr-4\">Free-draining; ~40% void space moves water straight through the 1-inch layer</td><td class=\"py-3\">Poor; fines hold water like a sponge, layer stays saturated</td></tr><tr class=\"border-b border-brand-bonewhite/10\"><td class=\"py-3 pr-4 font-medium\">Freeze-thaw on Barrie clay</td><td class=\"py-3 pr-4\">Minimal heave — there is little retained water to freeze and expand</td><td class=\"py-3\">High heave risk — saturated fines expand each cycle, pavers lift and settle unevenly</td></tr><tr class=\"border-b border-brand-bonewhite/10\"><td class=\"py-3 pr-4 font-medium\">Efflorescence risk</td><td class=\"py-3 pr-4\">Lower — washed stone carries far less soluble dust</td><td class=\"py-3\">Higher — limestone fines feed the white calcium bloom on paver surfaces</td></tr><tr class=\"border-b border-brand-bonewhite/10\"><td class=\"py-3 pr-4 font-medium\">Compaction</td><td class=\"py-3 pr-4\">Locks up with one plate-compactor pass; angular stone interlocks</td><td class=\"py-3\">Compacts to a hard mat, but the mat traps moisture underneath</td></tr><tr class=\"border-b border-brand-bonewhite/10\"><td class=\"py-3 pr-4 font-medium\">Screeding ease</td><td class=\"py-3 pr-4\">Slightly slower — the stone wants to shift under the screed bar</td><td class=\"py-3\">Very easy — the dust paste pulls glass-smooth</td></tr><tr class=\"border-b border-brand-bonewhite/10\"><td class=\"py-3 pr-4 font-medium\">Material cost</td><td class=\"py-3 pr-4\">Higher per tonne; a 400 sq ft patio needs roughly 1.6 tonnes total</td><td class=\"py-3\">Lower per tonne; same ~1.6 tonnes for a 400 sq ft patio</td></tr><tr><td class=\"py-3 pr-4 font-medium\">Best suited to</td><td class=\"py-3 pr-4\">Patios, walkways and driveways on clay or anywhere freeze-thaw is severe</td><td class=\"py-3\">Small, well-drained garden paths where budget dominates and heave is low-stakes</td></tr></tbody></table><p>The table tells the whole story in one glance: screenings win on screeding ease and upfront price; HPB wins on every property that determines how the patio looks in year five. If you are weighing base materials too, the same drainage logic applies — which is why our base spec is 12–16 inches of <strong>compacted clear stone, not granular A</strong>, on driveway work.</p>" }} />

      <h2>When Limestone Screenings Are Still the Right Call</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>To be fair, screenings are not a scam — they are a material with a narrow lane. On a small garden path over sandy, free-draining subsoil, where a half-inch of seasonal movement would go unnoticed and nobody is driving a car across it, screenings screed fast and perform acceptably. They are also the right aggregate for a completely different job: the compacted setting course under flagstone on mortar, where drainage through the bedding is not part of the design at all.</p><p>The rules for using screenings well are strict: keep the layer to exactly 1 inch, never use screenings as a thick make-up layer to fix elevation (add compacted stone to the base instead), and do not use them as the bedding under a driveway, a pool deck, or any patio on clay — which is most of Barrie. And never let a contractor talk you into screenings <em>under</em> the base as a cheap substitute for clear stone: that is the recipe behind many of the <a href=\"/resources/why-patios-sink-barrie\">sinking patios we are called to fix</a>, where a 3–4 inch mat of dust under 6 inches of stone has slowly swallowed the whole surface.</p><p>If a quote you received specifies screenings as bedding, ask the contractor one question: &#39;What happens to the water sitting in the bedding on a clay lot in January?&#39; The answer tells you whether they have thought about drainage at all. Our <a href=\"/library/patios\">patio construction library</a> covers the rest of the questions worth asking before you sign.</p>" }} />

      <h2>What We Install Under Pavers in Barrie</h2>
      <div dangerouslySetInnerHTML={{ __html: "<p>Our spec for interlocking work in Barrie is built around one principle: water must always have somewhere to go. On clay subsoil we start with a woven geotextile fabric so fine clay cannot migrate upward into the stone over the years — skip this and the base slowly turns to mud from below. Above the fabric goes compacted clear stone in 3–4 inch lifts: 6–10 inches for patios and walkways, 12–16 inches for driveways. Each lift gets compacted before the next goes down, because one deep uncompacted layer will settle no matter how good the surface looks on day one.</p><p>The bedding is a strict 1-inch screeded layer of washed 3/8-inch HPB — never screenings on our clay jobs. Pavers go down, the surface gets one pass with a plate compactor (with a polyurethane pad to protect the paver face), then polymeric sand is swept and activated into the joints. Finally, the finished surface is graded at roughly 2% — about 2 cm of fall per metre — so surface water runs off instead of ponding on the joints.</p><p>That full stack is why a properly built interlock surface in Simcoe County routinely outlasts the 25-year design life of the pavers themselves, while a screenings-bedded patio on the same clay is often being lifted and re-levelled inside a decade. The bedding is the cheapest layer in the entire build — roughly 1.6 tonnes of material on a 400 sq ft patio — and it is the worst place to economize. Run your own numbers on the <a href=\"/cost-estimator\">cost estimator</a> and you will see the material line barely moves the total.</p>" }} />

      <h2>Frequently Asked Questions</h2>
      <div className="mt-8">
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">What is HPB bedding for pavers?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>HPB (High Performance Bedding) is a 3/8-inch washed, angular clear limestone with no fine particles. It is screeded in a strict 1-inch layer directly under interlocking pavers. Because it contains no fines, water passes straight through instead of pooling, which makes it the preferred bedding in Barrie's clay soils and freeze-thaw winters.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">Will limestone screenings damage my pavers?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Screenings do not chemically damage pavers, but their fine dust holds water. In Barrie clay that water has nowhere to go, so it freezes and expands through the winter, nudging pavers out of level. Screenings also raise the odds of efflorescence — the white calcium haze that blooms on paver surfaces — because moisture migrating through limestone fines carries dissolved salts to the surface.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">How thick should the bedding layer be under interlocking pavers?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Exactly 1 inch (25 mm), screeded level. A bedding layer thicker than 1.5 inches is a common DIY failure: the loose material never fully locks up, and foot traffic plus freeze-thaw compacts it unevenly, leaving waves and dips within 1–2 winters. If you need to make up elevation, add it to the compacted clear-stone base below, never to the bedding.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">Does the bedding choice matter if I use polymeric sand in the joints?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Yes — they work as a team. Polymeric sand locks the joints against weeds and ants, but it is not a waterproof membrane. Water still enters through joints and drains downward. If the bedding is screenings that hold water, the base stays wet; if it is HPB, water keeps moving through the 1-inch bedding into the clear-stone base below. Good jointing sand cannot rescue a soggy bedding layer.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">Which is cheaper: HPB or limestone screenings in Barrie?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>Screenings are the cheaper material per tonne at most Barrie-area quarries, but the saving is small in context: a 400 sq ft patio needs roughly 1.6 tonnes of bedding, so the material difference is measured in the low hundreds of dollars against a project worth many thousands. A relay caused by a failed bedding layer costs far more than HPB ever saves upfront.</p>" }} />
        </div>
        <div className="mb-8">
          <h3 className="font-display text-2xl text-brand-bonewhite mb-3">How deep should the base be under an interlocking patio in Barrie?</h3>
          <div dangerouslySetInnerHTML={{ __html: "<p>For patios and walkways, 6–10 inches of compacted clear stone; for driveways that carry vehicles, 12–16 inches of compacted clear stone — never granular A. In Barrie, we also separate the base from clay subsoil with a geotextile fabric so fine clay cannot migrate upward into the stone over time.</p>" }} />
        </div>
      </div>

      <AuthorBio bio={"Yorkis Estevez is the founder of Golden Maple Landscaping, an interlocking and outdoor construction company serving Barrie and Simcoe County. His crews build interlock driveways and patios on 12–16 inches of compacted clear stone with HPB bedding, engineered for Ontario freeze-thaw. He writes about the base-and-bedding decisions that determine whether a patio lasts 25 years or needs a relay in 8."} />

      <div dangerouslySetInnerHTML={{ __html: "<p>Choosing the right bedding is a small decision with a 25-year consequence. If you are planning an interlocking patio or driveway in Barrie, <a href='/contact'>contact us</a> or <a href='/book'>book a site visit</a> — we will look at your soil, your drainage, and give you a straight answer on what belongs under your pavers. You can also run your own numbers on our <a href='/cost-estimator'>cost estimator</a> first.</p>" }} />
    </BlogPostLayout>
  );
}
