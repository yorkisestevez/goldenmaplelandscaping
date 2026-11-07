import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';
import { Link } from 'react-router-dom';
import { BUSINESS, publicPostalAddress } from '../../data/business';
import { OWNER_FACTS, ownerFact } from '../../data/ownerFacts';
import { BOOKING_WINDOW } from '../../data/pageUpdates';
import type { ReactNode } from 'react';

const NOT_PUBLISHED = 'Not published on this site yet. Ask for the current document.';

function addressLine(): string {
  const a = publicPostalAddress();
  return 'streetAddress' in a ? `${a.streetAddress}, ${a.addressLocality}, ${a.addressRegion} ${a.postalCode}` : `${a.addressLocality}, ${a.addressRegion}`;
}

/**
 * The comparison checklist. The third column states only what Golden Maple itself
 * publishes, read from src/data. No claims about any other contractor. Owner
 * facts that are not on file render as "not published", never as a guess.
 */
const COMPARE_ROWS: { criterion: string; ask: string; publishes: ReactNode }[] = [
  {
    criterion: 'Who runs the business, and where',
    ask: 'What is your business address, and who is responsible for my job?',
    publishes: `${addressLine()}. ${BUSINESS.founder.value.name}, ${BUSINESS.founder.value.role}, is named on the site.`,
  },
  {
    criterion: 'WSIB',
    ask: 'Can I see your current WSIB clearance certificate?',
    publishes: ownerFact(OWNER_FACTS.wsibStatus) ?? NOT_PUBLISHED,
  },
  {
    criterion: 'Liability coverage',
    ask: 'What liability coverage do you carry, and can I see the certificate?',
    publishes: ownerFact(OWNER_FACTS.liabilityCoverage) ?? NOT_PUBLISHED,
  },
  {
    criterion: 'Certifications',
    ask: 'Which certifications do you hold, and where can I check them with the issuer?',
    publishes: ownerFact(OWNER_FACTS.certifications) ?? 'None published on this site yet.',
  },
  {
    criterion: 'Price before the site visit',
    ask: 'Do you publish a planning range before you visit?',
    publishes: (
      <>
        Planning ranges on the interlocking and retaining wall service pages, and the <Link to="/cost-estimator">cost estimator</Link>. A range is not a quote.
      </>
    ),
  },
  {
    criterion: 'Base and drainage',
    ask: 'How deep will you dig, and is the base written into the quote?',
    publishes: 'Excavation, drainage and materials are set for the site and written into the scope for that property. No single depth is published for every patio.',
  },
  {
    criterion: 'Written terms',
    ask: 'What workmanship terms do I get in writing?',
    publishes: ownerFact(OWNER_FACTS.warrantyTerm) ?? 'Written project terms and communication details are confirmed before work begins.',
  },
  {
    criterion: 'Recent work',
    ask: 'Can I see projects you completed recently?',
    publishes: (
      <>
        A <Link to="/portfolio">portfolio</Link> of owner-photographed Golden Maple jobs.
      </>
    ),
  },
  {
    criterion: 'Reviews',
    ask: 'Where can I read your reviews?',
    publishes: (
      <>
        Google reviews, linked from the <Link to="/reviews">reviews page</Link>. The site does not republish review text.
      </>
    ),
  },
  {
    criterion: 'Start date',
    ask: 'When could you start, and when is the site visit?',
    publishes: BOOKING_WINDOW,
  },
];

export default function ChoosingContractor() {
  return (
    <BlogPostLayout
      title="How to Choose a Landscaping Contractor in Barrie (Without Getting Burned)"
      seoTitle="How to Choose a Landscaping Contractor Barrie | 7 Questions to Ask | Golden Maple"
      seoDescription="The 7 critical questions every Barrie homeowner must ask before hiring a landscaping contractor. Learn the red flags that separate professionals from problems."
      category="Hiring Guide"
      date="February 20, 2026"
      dateModified="November 7, 2026"
      readTime="9 min read"
      heroImage="/images/projects/IMG_4826.jpg"
    >
      <p>Every week, contractors get calls from homeowners who are mid-project with another contractor — and it's falling apart. Communication stopped. The timeline is blown. There are "surprise" costs that weren't in the original quote. And they're asking us if contractors can come fix it.</p>

      <p>The truth is, <strong>most of these problems were avoidable.</strong> Here are the seven questions that will help you separate the professionals from the problems before you sign anything.</p>

      <h2>1. "Can I See Your WSIB Clearance Certificate?"</h2>

      <p>This isn't optional. If a worker gets injured on your property and the contractor doesn't carry WSIB (Workplace Safety and Insurance Board) coverage, <strong>you could be held liable.</strong> Not the contractor — you. The homeowner.</p>

      <p>A legitimate contractor will have their WSIB clearance certificate and be happy to show it. If they dodge this question or say "it's not needed," that's your first red flag — and your cue to walk away.</p>

      <h2>2. "What Liability Insurance Do You Carry?"</h2>

      <p>Accidents happen. Equipment hits a gas line. A wall shifts and damages a property line. A delivery truck cracks the driveway. Without adequate liability coverage, you're exposed.</p>

      <p>Look for a minimum of <strong>$2 million in general liability coverage</strong>. Ask each contractor for current coverage documentation appropriate to the project.</p>

      <h2>3. "How Deep Will You Dig the Base?"</h2>

      <p>This is the question that separates contractors who build for the first summer from contractors who build for the next thirty years. In Simcoe County, with the clay soil and extreme freeze-thaw cycles, the base needs to be <strong>12-16 inches deep.</strong></p>

      <p>If they say 6-8 inches, they're building to the bare minimum. Your patio will look great in July and start sinking by the following spring.</p>

      <h2>4. "Can I See Three Recent Projects You've Completed?"</h2>

      <p>Not photos from their website — actual projects you can drive to and see in person. Ideally projects that are <strong>2-3 years old</strong>, so you can see how they've held up through multiple winters.</p>

      <p>Pay attention to the details: Are the joints tight? Are the edges clean? Is the surface level and draining properly? These things tell you more about a contractor's quality than any brochure.</p>

      <h2>5. "What Does Your Quote Include, Exactly?"</h2>

      <p>A professional quote should itemize:</p>

      <ul>
        <li>Excavation depth and disposal</li>
        <li>Base materials (type, depth, and compaction method)</li>
        <li>Paver or stone selection (specific brand and model)</li>
        <li>Edge restraint system</li>
        <li>Polymeric sand type</li>
        <li>Drainage provisions</li>
        <li>Site cleanup and restoration</li>
        <li>Warranty terms</li>
      </ul>

      <p>If you get a quote that's one line — "Patio installation: $12,000" — that's not a quote. That's a guess. And guesses lead to "surprise" extras once the project starts.</p>

      <h2>6. "Who Will Be On-Site Managing the Project?"</h2>

      <p>Some companies sell the job and then subcontract it to whoever's available. You met a polished salesperson, but the crew that shows up has never seen your design and doesn't know your expectations.</p>

      <p>Ask specifically: Will the person I'm speaking with be on-site? How often? What's the communication schedule? Confirm who will supervise the work, their communication schedule, and the appropriate point of contact in the written scope.</p>

      <h2>7. "What Warranty Do You Offer — and What Does It Cover?"</h2>

      <p>The word "warranty" means nothing without specifics. Ask:</p>

      <ul>
        <li>Does it cover <strong>settling and sinking</strong>? (This is the most common issue)</li>
        <li>How long does it last?</li>
        <li>What's the process for making a claim?</li>
        <li>Will the same company be around in 5 years to honour it?</li>
      </ul>

      <p></p>

      <blockquote>
        <p>"The best warranty is one you never need to use. That starts with building it right."</p>
      </blockquote>

      <h2>How to compare Barrie landscaping contractors</h2>

      <p>Ask every contractor on your shortlist the same questions and write the answers down side by side. The third column shows what Golden Maple publishes for each one, so you can check us the same way.</p>

      <div className="not-prose overflow-x-auto my-10">
        <table className="w-full min-w-[640px] text-left font-sans text-sm border-collapse">
          <caption className="sr-only">How to compare Barrie landscaping contractors: criteria, what to ask, and what Golden Maple publishes</caption>
          <thead>
            <tr className="border-b border-brand-gold/30">
              <th scope="col" className="py-3 pr-4 text-brand-gold-dark font-normal uppercase tracking-[0.15em] text-[11px]">Criteria</th>
              <th scope="col" className="py-3 pr-4 text-brand-gold-dark font-normal uppercase tracking-[0.15em] text-[11px]">What to ask</th>
              <th scope="col" className="py-3 pr-4 text-brand-gold-dark font-normal uppercase tracking-[0.15em] text-[11px]">What Golden Maple publishes</th>
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.criterion} className="border-b border-brand-dim/30 align-top">
                <th scope="row" className="py-4 pr-4 text-brand-bonewhite font-normal">{row.criterion}</th>
                <td className="py-4 pr-4 text-brand-muted font-light">{row.ask}</td>
                <td className="py-4 text-brand-muted font-light [&_a]:text-brand-gold-dark [&_a]:underline">{row.publishes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>The Red Flags Checklist</h2>

      <p>Walk away if you see any of these:</p>

      <ul>
        <li>No written contract or vague terms</li>
        <li>Requesting more than 30% deposit upfront</li>
        <li>No WSIB or insurance documentation</li>
        <li>Can't provide references from the last 12 months</li>
        <li>Pressuring you to "decide today" or offering a "today-only" discount</li>
        <li>No specific base depth in the quote</li>
        <li>No physical business address or professional web presence</li>
      </ul>

      <p>Hiring the right contractor isn't about finding the cheapest price. It's about finding someone whose standards, communication, and integrity match the investment you're making in your home.</p>
      <AuthorBio bio={`${BUSINESS.publicName.value} publishes this general educational guide. Project-specific scope, materials, permits, and written terms should be confirmed before work begins.`} />

    </BlogPostLayout>
  );
}
