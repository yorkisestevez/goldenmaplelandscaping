import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';
import { BUSINESS } from '../../data/business';

export default function ChoosingContractor() {
  return (
    <BlogPostLayout
      title="How to Choose a Landscaping Contractor in Barrie (Without Getting Burned)"
      seoTitle="How to Choose a Landscaping Contractor Barrie | 7 Questions to Ask | Golden Maple"
      seoDescription="The 7 critical questions every Barrie homeowner must ask before hiring a landscaping contractor. Learn the red flags that separate professionals from problems."
      category="Hiring Guide"
      date="February 20, 2026"
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

      <p>Ask each contractor for current written workmanship terms, including coverage, exclusions, remedy, and any maintenance requirements.</p>

      <blockquote>
        <p>"The best warranty is one you never need to use. That starts with building it right."</p>
      </blockquote>

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
