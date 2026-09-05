import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';
import CostGuideInlineCTA from '../../components/CostGuideInlineCTA';
import { BUSINESS } from '../../data/business';

export default function HiddenCostsCheapLandscaping() {
  return (
    <BlogPostLayout
      title="The Hidden Costs of 'Cheap' Landscaping"
      seoTitle="Hidden Costs of Cheap Landscaping | Lowest Bid Dangers | Golden Maple"
      seoDescription="Why accepting the lowest landscaping bid often costs double in the end. A look at the cut corners in cheap patio installations and failing retaining walls."
      category="Investment"
      date="March 28, 2026"
      readTime="6 min read"
      heroImage="/images/projects/IMG_4826.jpg"
    >
      <p>You’ve gathered three quotes for your new backyard patio. Two contractors came in around $35,000. The third contractor said they could do it for $18,000.</p>

      <p>Human nature tells you to go with the $18,000 quote. It's just some stones and dirt, right? How different could the final product really be?</p>

      <p>The answer is: completely different. The $18,000 quote isn't a bargain. It's a ticking time bomb. Let's look exactly where that 'discount' is coming from.</p>

      <h2>Where the Cheap Contractor Cuts Corners</h2>

      <p>A premium landscaping company has fixed costs—materials, insurance, machinery, and skilled labour. If someone is bidding half the price, they aren't working for free; they are simply installing half the product. Here is what you are missing when you take the lowest bid:</p>

      <h3>1. The Invisible Foundation (The 6-Inch Base)</h3>
      <p>The number one place cheap contractors save money is excavation. Digging properly requires heavy machinery, expensive disposal bins, and tons of new aggregate.</p>
      <p>A professional contractor digs 14-16 inches deep for a patio to get below the frost heave zone. The cheap contractor digs 4-6 inches. On day one, both patios look identical. After one Barrie winter, the shallow base will heave, sink, and crack.</p>

      <h3>2. Skipping the Geotextile and Geogrid</h3>
      <p>Geotextile fabric separates your clay soil from the clear stone base. Without it, the clay eventually migrates up into the stone, ruining its drainage capacity. Geogrid is a high-tensile mesh used to tie retaining walls securely into the earth.</p>
      <p>These materials cost money and take time to install correctly. The low bidder skips them entirely. When your retaining wall starts leaning forward 18 months later, this is why.</p>

      <h3>3. Poor Drainage Planning</h3>
      <p>Water is the enemy of hardscaping. A proper patio installation includes subtle grading (a 1.5% to 2% slope), perforated drain tiles, and careful assessment of where water will flow during a storm.</p>
      <p>Cheap installations act like dams. They trap water against your house foundation, leading to flooded basements, or pool water on the patio surface, which freezes and destroys the pavers.</p>

      <h3>4. Bait-and-Switch Materials</h3>
      <p>That low quote likely doesn't specify the exact paver brand or line. You might assume you're getting a premium EnduraColor Unilock product, but the contractor shows up with a thin, builder-grade paver from a big-box store that will lose its colour within two years.</p>

      <h3>5. WSIB and Liability Insurance</h3>
      <p>This is the scariest cut corner. Premium contractors pay significant premiums for WSIB (Workplace Safety and Insurance Board) and multimillion-dollar liability policies.</p>
      <p>The guy in the unmarked truck doing it for $18k cash? He likely has neither. If one of his workers cuts their foot with a quick-cut saw on your property, <strong>you can be held personally liable for their medical bills and lost wages.</strong></p>

      <h2>The True Cost of Doing It Twice</h2>

      <p>Every year, half of the summer schedule is spent ripping out "cheap" patios and failing retaining walls that were installed 2 or 3 years prior.</p>

      <p>Here is the real math on that $18,000 "bargain":</p>
      <ul>
        <li>Initial cheap installation: $18,000</li>
        <li>Cost to demolish and dump the failed patio: $5,000</li>
        <li>Cost to finally build it correctly: $35,000</li>
        <li><strong>Total actual cost: $58,000</strong></li>
      </ul>

      <blockquote>
        <p>"You aren't saving $17,000 by choosing the lowest bid. You are just paying an $18,000 deposit on a headache you'll have to fix in three years."</p>
      </blockquote>

      <CostGuideInlineCTA />

      <h2>How to Protect Yourself</h2>

      <p>If a quote seems too good to be true, ask the contractor these specific questions in writing:</p>
      <ol>
        <li>"Exactly how many inches deep will you excavate for the base?"</li>
        <li>"Are you using 3/4 clear stone or gravel dust for the base?"</li>
        <li>"Can you provide a current WSIB clearance certificate today?"</li>
        <li>"Does your contract include a multi-year warranty covering sinking and settlement?"</li>
      </ol>

      <p>If they hesitate on any of these, walk away. Your home is too valuable to trust to the lowest bidder.</p>
      <AuthorBio bio={`${BUSINESS.publicName.value} publishes this general educational guide. Project-specific scope, materials, permits, and written terms should be confirmed before work begins.`} />

    </BlogPostLayout>
  );
}
