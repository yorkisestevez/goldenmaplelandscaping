import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';
import { BUSINESS } from '../../data/business';

export default function OutdoorKitchenGuide() {
  return (
    <BlogPostLayout
      title="Planning an Outdoor Kitchen in Ontario: What You Need to Know"
      seoTitle="Outdoor Kitchen Planning Guide Ontario | Gas, Materials & Layout | Golden Maple"
      seoDescription="Complete planning checklist for building an outdoor kitchen in Ontario. Covers gas lines, countertop materials, drainage, winter protection, and realistic budgets."
      category="Outdoor Living"
      date="February 5, 2026"
      readTime="7 min read"
      heroImage="/images/projects/luxury outdoor kitchen.jpeg"
    >
      <p>An outdoor kitchen isn't just a grill on a patio. Done right, it's a <strong>fully functional cooking and entertaining space</strong> that changes how your family lives from May through October — and even beyond, if you're the kind of person who grills in a January snowstorm (contractors see you, Barrie).</p>

      <p>But an outdoor kitchen involves more planning than most homeowners realize. Gas lines, electrical, drainage, material selection, and layout all need to work together. Here's what you need to think about before breaking ground.</p>

      <h2>Location and Layout</h2>

      <p>The three biggest mistakes homeowners make with outdoor kitchen placement:</p>

      <ul>
        <li><strong>Too far from the house:</strong> You'll be running back and forth for plates, utensils, and drinks. Your outdoor kitchen should be a natural extension of your interior kitchen — close enough to be convenient, far enough to feel like a destination.</li>
        <li><strong>Ignoring wind direction:</strong> In Simcoe County, prevailing winds come from the northwest. Position your grill so smoke blows away from the seating area, not into it.</li>
        <li><strong>No shade strategy:</strong> A pergola or covered structure isn't a luxury — it's a necessity. You need protection from both sun and rain during Ontario summers.</li>
      </ul>

      <h3>The Work Triangle</h3>
      <p>Just like an indoor kitchen, your outdoor space should follow the work triangle principle: <strong>grill, prep area, and sink/fridge</strong> should form a triangle with sides of 4-9 feet. This creates an efficient workflow that makes cooking enjoyable rather than exhausting.</p>

      <h2>Gas Line Considerations</h2>

      <p>If you want a built-in natural gas grill (and you should — propane tanks are inconvenient and run out at the worst possible moment), you'll need a licensed gas fitter to run a dedicated line from your home's gas meter.</p>

      <ul>
        <li><strong>Permit required:</strong> A gas permit and inspection are mandatory in Ontario.</li>
        <li><strong>BTU calculations:</strong> Your gas line needs to supply enough BTUs for all your appliances — grill, side burner, fire feature — running simultaneously.</li>
        <li><strong>Shut-off valve:</strong> A dedicated shut-off valve at the outdoor kitchen, accessible and clearly marked.</li>
        <li><strong>Budget:</strong> Gas line installation typically runs $1,500-$3,500 depending on distance from the meter.</li>
      </ul>

      <h2>Countertop Materials That Survive Ontario</h2>

      <p>Not every material that works in an indoor kitchen can handle -30°C winters and 35°C summers. Here's what actually holds up:</p>

      <ul>
        <li><strong>Granite:</strong> The gold standard. Extremely durable, heat-resistant, and handles freeze-thaw beautifully. Budget $80-$150/sq ft installed.</li>
        <li><strong>Dekton:</strong> Ultra-compact surface that's virtually indestructible. UV-resistant, heat-resistant, and stain-proof. Premium price but zero maintenance.</li>
        <li><strong>Concrete:</strong> Can be custom-cast to any shape. Needs sealing annually but develops a beautiful patina over time.</li>
        <li><strong>Tile:</strong> Affordable but the grout lines are maintenance-heavy. Best reserved for less-used surfaces.</li>
      </ul>

      <p><strong>Avoid:</strong> Marble (too porous and soft for outdoor use), laminate (will delaminate), and quartz (most quartz is not UV-stable and will discolour outdoors).</p>

      <h2>The Foundation Matters</h2>

      <p>Your outdoor kitchen needs to sit on a base that won't move. This means the same deep base preparation contractors use for patios — <strong>12-16 inches of compacted clear stone.</strong> A kitchen island that shifts even slightly can crack gas lines, misalign countertops, and create safety hazards.</p>

      <blockquote>
        <p>"An outdoor kitchen is only as good as what it's sitting on. An outdoor kitchen base should be designed for its loads, utilities, drainage, and site conditions because movement can affect connected components."</p>
      </blockquote>

      <h2>Realistic Budget Ranges for Simcoe County</h2>

      <ul>
        <li><strong>Basic (grill + counter + storage):</strong> $15,000-$25,000</li>
        <li><strong>Mid-range (add sink, fridge, side burner):</strong> $25,000-$45,000</li>
        <li><strong>Premium (full kitchen with pizza oven, bar seating, lighting):</strong> $45,000-$80,000+</li>
      </ul>

      <p>These ranges include the hardscape foundation, veneer, countertops, appliances, gas line, electrical, and installation. The variables that move the needle most are countertop material, appliance selection, and the size of the structure.</p>

      <h2>Winter Protection</h2>

      <p>Your outdoor kitchen lives outside year-round. Protect your investment:</p>

      <ul>
        <li>Custom-fitted covers for all appliances</li>
        <li>Drain and disconnect any water lines before the first freeze</li>
        <li>Store cushions and accessories indoors</li>
        <li>Avoid using salt near natural stone veneers</li>
      </ul>
      <AuthorBio bio={`${BUSINESS.publicName.value} publishes this general educational guide. Project-specific scope, materials, permits, and written terms should be confirmed before work begins.`} />

    </BlogPostLayout>
  );
}
