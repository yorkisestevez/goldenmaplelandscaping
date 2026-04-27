import { motion } from 'motion/react';
import { ArrowRight, Clock, User, Tag } from 'lucide-react';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';

const POSTS = [
  {
    id: 1,
    title: "Best Interlocking Stone Installers in Barrie: Why Base Depth is Everything",
    excerpt: "Searching for the best interlocking installers in Barrie? Discover why our 12-16\" compacted base exceeds industry standards and prevents shifting.",
    date: "March 21, 2024",
    author: "Yorkis Estevez",
    category: "Engineering",
    img: "/images/projects/paver-driveway.JPG"
  },
  {
    id: 2,
    title: "TimberTech vs. AZEK: Choosing the Best Composite Deck for Simcoe County Winters",
    excerpt: "We compare TimberTech and AZEK decking performance in Ontario's harsh winters. Learn why PVC is the premier choice for Barrie homeowners.",
    date: "March 21, 2024",
    author: "Yorkis Estevez",
    category: "Materials",
    img: "/images/projects/composite deck.jpeg"
  },
  {
    id: 3,
    title: "5 Red Flags When Hiring a Landscape Contractor in Barrie, ON",
    excerpt: "Don't fall for the 'contractor runaround.' We reveal the common red flags to watch for when hiring landscaping services in Simcoe County.",
    date: "March 20, 2024",
    author: "Yorkis Estevez",
    category: "Trust",
    img: "/images/projects/Yorkis Estevez.png"
  },
  {
    id: 4,
    title: "The Paving Elite: Choosing Between Unilock, Techo-Bloc & Permacon",
    excerpt: "A deep dive into Ontario's top paver manufacturers. We help Barrie homeowners choose between Unilock, Techo-Bloc, and Permacon for their next project.",
    date: "March 20, 2024",
    author: "Yorkis Estevez",
    category: "Materials",
    img: "/images/projects/Permacon-approved.jpeg"
  },
  {
    id: 5,
    title: "How Deep Should an Interlocking Base Be in Barrie, ON?",
    excerpt: "Learn why our 12-16\" compacted base depth is the key differentiator for enduring interlocking stone projects in Simcoe County.",
    date: "March 15, 2024",
    author: "Yorkis Estevez",
    category: "Engineering",
    img: "/images/projects/orillia-walkway.png"
  },
  {
    id: 6,
    title: "Landscape Design Trends for 2024: Outdoor Living Reimagined",
    excerpt: "Discover the latest trends in backyard renovations, from integrated fire features to sustainable landscape lighting in Midhurst & Shanty Bay.",
    date: "March 5, 2024",
    author: "Yorkis Estevez",
    category: "Design",
    img: "/images/projects/rendering1.jpg"
  }
];

export default function Blog() {
  return (
    <div className="pt-32 bg-brand-black min-h-screen">
      <SEO 
        title="Landscaping Tips & Guides | Barrie"
        description="Expert landscaping advice for Barrie homeowners. Interlocking costs, design trends, seasonal tips & project inspiration from Simcoe County's top contractor."
      />
      
      <div className="max-w-[1200px] mx-auto px-6 md:px-12 py-24">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <div className="font-sans text-[10px] tracking-[0.35em] uppercase text-brand-gold mb-8">
            Our Blog
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[1.1] mb-10 text-brand-bone">
            Landscaping Advice <br />
            <span className="italic text-brand-gold">for Simcoe County.</span>
          </h1>
          <p className="font-sans font-light text-lg text-brand-muted leading-[1.8]">
            Expert insights on hardscape engineering, landscape design, and property maintenance. We share our knowledge to help you make informed decisions for your outdoor living space.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-32">
          {POSTS.map((post, idx) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: idx * 0.1 }}
              className="group flex flex-col bg-brand-dark border border-brand-gold/10 rounded-[2px] overflow-hidden hover:border-brand-gold/40 transition-all"
            >
              <div className="h-[250px] overflow-hidden relative">
                <img
                  src={post.img}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 grayscale-[20%]"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-6 left-6 bg-brand-gold text-brand-black px-4 py-1 font-sans text-[10px] uppercase tracking-widest font-bold">
                  {post.category}
                </div>
              </div>
              <div className="p-8 md:p-10 flex flex-col flex-1">
                <div className="flex items-center gap-6 mb-6 font-sans text-[10px] uppercase tracking-widest text-brand-dim">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-brand-gold" />
                    <span>{post.date}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User size={14} className="text-brand-gold" />
                    <span>{post.author}</span>
                  </div>
                </div>
                <h2 className="font-display text-2xl text-brand-bone mb-6 group-hover:text-brand-gold transition-colors duration-500 leading-tight">
                  {post.title}
                </h2>
                <p className="font-sans font-light text-[14px] text-brand-muted leading-[1.7] mb-10 flex-1">
                  {post.excerpt}
                </p>
                <Link 
                  to={`/blog/${post.id}`} 
                  className="flex items-center gap-4 text-brand-gold font-sans text-[10px] uppercase tracking-[0.3em] group-hover:gap-6 transition-all"
                >
                  <span>Read Full Article</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </motion.article>
          ))}
        </div>

        <div className="text-center bg-brand-deeper p-16 border border-brand-gold/10 rounded-[2px]">
          <h2 className="font-display text-4xl text-brand-bone mb-8">Have a specific question?</h2>
          <p className="font-sans font-light text-brand-muted mb-12 max-w-2xl mx-auto">
            Our team is here to help. Contact Golden Maple Landscaping today for expert advice and to start your project with a professional consultation.
          </p>
          <Link to="/contact" className="btn-primary px-12 py-5">Discuss Your Property</Link>
        </div>
      </div>
    </div>
  );
}
