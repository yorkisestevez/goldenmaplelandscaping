import BlogPostLayout from '../../components/BlogPostLayout';
import AuthorBio from '../../components/AuthorBio';
import { BUSINESS } from '../../data/business';

export default function WhyPatiosSink() {
  return (
    <BlogPostLayout
      title="Why Patios Sink in Barrie (And How to Prevent It)"
      seoTitle="Why Patios Sink in Barrie | Freeze-Thaw Prevention Guide | Golden Maple"
      seoDescription="Learn how drainage, soil, site preparation and installation details can contribute to patio settlement in Barrie. Ask for a project-specific repair or rebuilding plan."
      category="Engineering"
      date="March 15, 2026"
      readTime="4 min read"
      heroImage="/images/projects/IMG_4826.jpg"
    >
      <p>Uneven stones, opening joints and standing water can signal that a patio needs attention. They do not, by themselves, establish the cause or prove that a complete rebuild is necessary.</p>
      <h2>Start with the cause, not a universal excavation depth</h2>
      <p>Settlement can involve unsuitable or disturbed soil, inadequate compaction, water movement, loss of bedding material or edge restraint. Seasonal frost movement may also contribute. An assessment should consider how these factors interact at the property.</p>
      <p>A fixed excavation depth is not a substitute for design. A pedestrian patio and a vehicle-bearing driveway can have different requirements. Soil conditions, loads, drainage, material specifications and applicable requirements should inform the written plan.</p>
      <h2>What to document before rebuilding</h2>
      <ul>
        <li><strong>Existing conditions:</strong> Record low spots, drainage paths, nearby downspouts, edges and areas of movement.</li>
        <li><strong>Excavation:</strong> Explain how unsuitable material will be identified and addressed, including how unforeseen conditions affect the quote.</li>
        <li><strong>Base and bedding:</strong> Identify materials, depths, compaction requirements and relevant manufacturer guidance.</li>
        <li><strong>Drainage:</strong> Show where water will go without creating a problem for buildings or neighbouring properties.</li>
        <li><strong>Separation and restraint:</strong> Explain where geotextile, edge restraint or other details are specified and why.</li>
      </ul>
      <h2>Repair or rebuild?</h2>
      <p>A localized issue may be repairable by lifting and reinstating an affected area after addressing its cause. Widespread movement or a defective underlying assembly may require more extensive work. Request an explanation of the proposed approach and its limitations before committing.</p>
      <p>For an inspection checklist, see <a href="/resources/failing-interlocking-patio-signs-barrie">how to check a failing patio and discuss repair versus rebuilding</a>.</p>
      <h2>Questions to ask when comparing quotes</h2>
      <ul>
        <li>What evidence supports the diagnosis?</li>
        <li>What preparation, material and drainage specifications are included?</li>
        <li>What is excluded, and how will changes be authorized?</li>
        <li>What written workmanship coverage, exclusions and remedies apply?</li>
      </ul>
      <p>Confirm specifications and current commercial terms for the particular project. This general guide is not an engineering design or a guarantee against future movement.</p>
      <AuthorBio bio={`${BUSINESS.publicName.value} publishes this general educational guide. Confirm project-specific scope, materials, permits and written terms before work begins.`} />
    </BlogPostLayout>
  );
}
