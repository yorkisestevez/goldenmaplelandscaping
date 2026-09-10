import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';
import { BUSINESS } from '../../data/business';

export default function FirePitRegulations() {
  return (
    <BlogPostLayout
      title="Fire Pit Rules in Barrie: Permits, Setbacks, and What You Can Actually Build"
      seoTitle="Fire Pit Rules Barrie Ontario | Permits & Bylaws Guide | Golden Maple"
      seoDescription="Plain-English guide to Barrie's fire pit regulations and bylaws. Covers permits, required setbacks, fuel types, and how to build a compliant fire feature for your backyard."
      category="Regulations"
      date="January 8, 2026"
      readTime="6 min read"
      heroImage="/images/projects/barrie-firepit-patio.jpg"
    >
      <p>You want a fire pit in your backyard. Simple enough, right? Not so fast. The City of Barrie has specific bylaws governing outdoor fires, and ignoring them can result in <strong>fines, forced removal, and a very awkward conversation with bylaw enforcement.</strong></p>

      <p>Here's a plain-English breakdown of what you can and can't do — current as of 2026.</p>

      <h2>Open-Air Fire Pits (Wood-Burning)</h2>

      <p>The City of Barrie's Open Air Burning By-law governs wood-burning fire pits. Here are the key rules:</p>

      <ul>
        <li><strong>Setback requirements:</strong> A minimum of 3 metres (approximately 10 feet) from any structure, property line, fence, or combustible material. This includes your house, your shed, your neighbour's fence, and overhead tree branches.</li>
        <li><strong>Pit size:</strong> The fire area should be no larger than 0.6 metres (2 feet) in diameter. Yes, that's smaller than you think.</li>
        <li><strong>Screen/spark guard:</strong> Must be covered with a mesh screen to prevent sparks from escaping.</li>
        <li><strong>Fuel:</strong> Only clean, dry firewood. No construction materials, painted wood, garbage, leaves, or yard waste.</li>
        <li><strong>Supervision:</strong> The fire must be attended at all times by a responsible adult. A garden hose or fire extinguisher must be within reach.</li>
        <li><strong>Wind conditions:</strong> Fires are prohibited when wind exceeds 20 km/h or during municipal fire bans.</li>
      </ul>

      <h2>Natural Gas & Propane Fire Features</h2>

      <p>This is where it gets much more interesting — and where contractors see the biggest opportunity for homeowners who want a <strong>premium fire experience without the regulatory headaches.</strong></p>

      <p>Gas fire features (natural gas or propane) are treated differently than wood-burning fires under most Ontario bylaws because they:</p>

      <ul>
        <li>Produce no sparks or embers</li>
        <li>Generate controlled, consistent heat</li>
        <li>Create no smoke (or minimal smoke with decorative media)</li>
        <li>Can be turned off instantly</li>
      </ul>

      <p>The result? Gas fire features can typically be placed <strong>closer to structures</strong> and have significantly fewer restrictions than wood-burning alternatives. However, they do require:</p>

      <ul>
        <li><strong>A licensed gas fitter</strong> for installation (this is non-negotiable and code-required in Ontario)</li>
        <li><strong>A gas permit</strong> and inspection by TSSA (Technical Standards and Safety Authority)</li>
        <li><strong>Proper ventilation</strong> if the feature is under a covered structure</li>
        <li><strong>An accessible shut-off valve</strong></li>
      </ul>

      <h2>Why Contractors Recommend Gas Fire Features</h2>

      <p>For the clients in Barrie and Simcoe County, contractors almost always recommend custom gas fire features over wood-burning pits. Here's why:</p>

      <ul>
        <li><strong>More placement flexibility:</strong> You can integrate them into patios, seat walls, and outdoor kitchens without worrying about the 3-metre setback.</li>
        <li><strong>Instant on/off:</strong> No waiting for the fire to die down. No dealing with embers and ash cleanup.</li>
        <li><strong>No smoke complaints:</strong> Smoke from wood fires is the #1 source of neighbour disputes in Barrie. Gas eliminates this entirely.</li>
        <li><strong>Year-round use:</strong> Works perfectly in any weather. No wet wood, no windblown sparks.</li>
        <li><strong>Cleaner:</strong> No ash, no soot, no creosote buildup on your patio furniture.</li>
      </ul>

      <h2>Custom Fire Feature Options</h2>

      <h3>Fire Pit Tables</h3>
      <p>A dining or coffee table with an integrated fire element. This is one of the most popular options because it serves double duty — it's functional furniture and an atmosphere generator.</p>

      <h3>Linear Fire Features</h3>
      <p>A long, narrow flame element built into a wall, counter, or freestanding structure. Creates a dramatic, contemporary look that works beautifully with modern architectures.</p>

      <h3>Fire Bowls</h3>
      <p>Statement pieces that sit on pedestals or within garden settings. These are sculptural elements that serve as focal points even when they're not lit.</p>

      <h3>Integrated Seat Walls with Fire</h3>
      <p>A retaining or seat wall with a fire element built directly into the top. This creates a natural gathering point and maximizes seating around the fire.</p>

      <blockquote>
        <p>"A fire feature isn't just a luxury — it extends your outdoor living season by weeks on both ends. The clients use their patios well into October and start again in early April, simply because the fire makes it comfortable and inviting."</p>
      </blockquote>

      <h2>Budget Expectations</h2>

      <ul>
        <li><strong>Simple propane fire pit (portable):</strong> $500-$2,000</li>
        <li><strong>Custom natural gas fire pit (built-in):</strong> $3,000-$8,000</li>
        <li><strong>Premium linear fire feature or fire table:</strong> $5,000-$15,000</li>
        <li><strong>Integrated fire feature with seat walls:</strong> $8,000-$20,000+</li>
      </ul>

      <p>These prices include the gas fitting, permits, and all masonry/hardscape work. Contractors typically integrate fire features into larger patio and outdoor kitchen projects, which creates cost efficiencies since the base preparation and material supply are already happening.</p>
      <AuthorBio bio={`${BUSINESS.publicName.value} publishes this general educational guide. Project-specific scope, materials, permits, and written terms should be confirmed before work begins.`} />

    </BlogPostLayout>
  );
}
