import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Grid, Hexagon, AlignJustify, ListTree, Layout,
  ChefHat, Flame, Sun, Leaf, Lightbulb, Map, Check, Phone
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PROJECT_TYPES = [
  { id: 'patio', label: 'Patio / Interlock', desc: 'Pavers and hardscape', icon: Grid },
  { id: 'stone', label: 'Natural Stone / Flagstone', desc: 'Irregular or cut stone', icon: Hexagon },
  { id: 'wall', label: 'Retaining Wall', desc: 'Block or armour stone', icon: AlignJustify },
  { id: 'steps', label: 'Steps & Walkway', desc: 'Precast or natural stone', icon: ListTree },
  { id: 'deck', label: 'Composite Deck', desc: 'Trex or TimberTech', icon: Layout },
  { id: 'kitchen', label: 'Outdoor Kitchen', desc: 'Cooking and dining', icon: ChefHat },
  { id: 'firepit', label: 'Fire Pit', desc: 'Prefab or custom built', icon: Flame },
  { id: 'pergola', label: 'Pergola / Shade Structure', desc: 'Wood or aluminum', icon: Sun },
  { id: 'turf', label: 'Artificial Turf', desc: 'Low maintenance lawn', icon: Leaf },
  { id: 'lighting', label: 'Landscape Lighting', desc: 'In-Lite systems', icon: Lightbulb },
  { id: 'full', label: 'Full Backyard (multiple)', desc: 'Complete transformation', icon: Map },
];

const CONDITIONS = [
  { id: 'access', label: 'Difficult access (no machine access, wheelbarrow only)' },
  { id: 'slope', label: 'Significant slope or grading needed' },
  { id: 'tearOut', label: 'Tear-out / demolition of existing surface' },
  { id: 'drainage', label: 'Drainage work needed' },
  { id: 'levels', label: 'Multiple levels or tiers' },
];

const MATERIALS = [
  { id: 'good', label: 'Premium Standard', desc: 'Quality interlock, clean design, built to last' },
  { id: 'better', label: 'Elevated Design', desc: 'Upgraded materials, more detail, standout results', badge: 'Most Popular' },
  { id: 'best', label: 'Signature Build', desc: 'Porcelain, natural stone, or full premium collection' },
];

export default function Estimator() {
  const [step, setStep] = useState(1);
  const [projectType, setProjectType] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<string[]>([]);
  const [sizes, setSizes] = useState<Record<string, any>>({
    patio: 500,
    stone: 500,
    wall: 50,
    wallHeight: '2-4ft',
    steps: 5,
    deck: 300,
    kitchen: 'Basic',
    firepit: 'Medium',
    pergola: 'Medium',
    turf: 500,
    lighting: 'Medium',
  });
  const [conditions, setConditions] = useState<Record<string, boolean>>({
    access: false,
    slope: false,
    tearOut: false,
    drainage: false,
    levels: false,
  });
  const [material, setMaterial] = useState('better');

  const handleSizeChange = (id: string, value: any) => {
    setSizes(prev => ({ ...prev, [id]: value }));
  };

  const toggleCondition = (id: string) => {
    setConditions(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleElement = (id: string) => {
    setSelectedElements(prev => 
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const estimates = useMemo(() => {
    const getElementEstimate = (type: string, sizeData: any, tier: string) => {
      let rateLow = 1, rateHigh = 1;
      let matLow = 0, matHigh = 0;
      let flatDaysLow = 0, flatDaysHigh = 0;
      
      let effectiveSize = typeof sizeData === 'number' ? sizeData : 0;
      
      if (type === 'patio') {
        if (tier === 'good') { rateLow = 400; rateHigh = 500; matLow = 8; matHigh = 12; }
        if (tier === 'better') { rateLow = 250; rateHigh = 350; matLow = 14; matHigh = 20; }
        if (tier === 'best') { rateLow = 300; rateHigh = 400; matLow = 22; matHigh = 35; }
      } else if (type === 'stone') {
        rateLow = 150; rateHigh = 250;
        if (tier === 'good') { matLow = 12; matHigh = 18; }
        if (tier === 'better') { matLow = 20; matHigh = 28; }
        if (tier === 'best') { matLow = 30; matHigh = 45; }
      } else if (type === 'wall') {
        let hMult = 1;
        if (sizes.wallHeight === '2-4ft') hMult = 1.5;
        if (sizes.wallHeight === '4-6ft') hMult = 2;
        if (sizes.wallHeight === 'Over 6ft') hMult = 3;
        effectiveSize = sizeData * hMult;
        
        if (tier === 'good') { rateLow = 40; rateHigh = 60; matLow = 30; matHigh = 45; }
        if (tier === 'better') { rateLow = 40; rateHigh = 60; matLow = 50; matHigh = 80; }
        if (tier === 'best') { rateLow = 20; rateHigh = 35; matLow = 90; matHigh = 140; }
      } else if (type === 'steps') {
        if (tier === 'good') { rateLow = 3; rateHigh = 5; matLow = 400; matHigh = 600; }
        if (tier === 'better') { rateLow = 3; rateHigh = 5; matLow = 500; matHigh = 800; }
        if (tier === 'best') { rateLow = 2; rateHigh = 4; matLow = 700; matHigh = 1200; }
      } else if (type === 'deck') {
        rateLow = 200; rateHigh = 300;
        if (tier === 'good') { matLow = 20; matHigh = 28; }
        if (tier === 'better') { matLow = 30; matHigh = 42; }
        if (tier === 'best') { matLow = 45; matHigh = 65; }
      } else if (type === 'turf') {
        rateLow = 500; rateHigh = 700;
        if (tier === 'good') { matLow = 10; matHigh = 14; }
        if (tier === 'better') { matLow = 14; matHigh = 18; }
        if (tier === 'best') { matLow = 18; matHigh = 25; }
      } else if (type === 'kitchen') {
        let isFull = sizeData === 'Full Build';
        if (tier === 'good') {
          flatDaysLow = isFull ? 6 : 3; flatDaysHigh = isFull ? 10 : 5;
          matLow = isFull ? 10000 : 4000; matHigh = isFull ? 25000 : 8000;
        }
        if (tier === 'better') {
          flatDaysLow = isFull ? 6 : 4; flatDaysHigh = isFull ? 10 : 7;
          matLow = isFull ? 15000 : 6000; matHigh = isFull ? 25000 : 10000;
        }
        if (tier === 'best') {
          flatDaysLow = isFull ? 6 : 4; flatDaysHigh = isFull ? 10 : 7;
          matLow = isFull ? 20000 : 8000; matHigh = isFull ? 25000 : 12000;
        }
        effectiveSize = 0;
      } else if (type === 'firepit') {
        if (tier === 'good') { flatDaysLow = 0.5; flatDaysHigh = 1; matLow = 800; matHigh = 2000; }
        if (tier === 'better') { flatDaysLow = 1; flatDaysHigh = 2; matLow = 1500; matHigh = 3500; }
        if (tier === 'best') { flatDaysLow = 1.5; flatDaysHigh = 3; matLow = 2000; matHigh = 5000; }
        effectiveSize = 0;
      } else if (type === 'pergola') {
        if (tier === 'good') { flatDaysLow = 2; flatDaysHigh = 3; matLow = 3000; matHigh = 5000; }
        if (tier === 'better') { flatDaysLow = 2; flatDaysHigh = 3; matLow = 5000; matHigh = 8000; }
        if (tier === 'best') { flatDaysLow = 3; flatDaysHigh = 4; matLow = 8000; matHigh = 12000; }
        effectiveSize = 0;
      } else if (type === 'lighting') {
        if (tier === 'good') { flatDaysLow = 1; flatDaysHigh = 2; matLow = 2500; matHigh = 4000; }
        if (tier === 'better') { flatDaysLow = 1; flatDaysHigh = 2; matLow = 4000; matHigh = 6000; }
        if (tier === 'best') { flatDaysLow = 2; flatDaysHigh = 3; matLow = 6000; matHigh = 10000; }
        effectiveSize = 0;
      }
  
      let rawDaysLow = effectiveSize > 0 ? (effectiveSize / rateHigh) * 1.25 : 0;
      let rawDaysHigh = effectiveSize > 0 ? (effectiveSize / rateLow) * 1.25 : 0;
      
      rawDaysLow += flatDaysLow;
      rawDaysHigh += flatDaysHigh;
  
      let materialCostLow = effectiveSize > 0 ? effectiveSize * matLow : matLow;
      let materialCostHigh = effectiveSize > 0 ? effectiveSize * matHigh : matHigh;
  
      return { rawDaysLow, rawDaysHigh, materialCostLow, materialCostHigh };
    };
  
    const calculateTier = (tier: string) => {
      let totalRawDaysLow = 0;
      let totalRawDaysHigh = 0;
      let totalMaterialLow = 0;
      let totalMaterialHigh = 0;
  
      const elementsToCalc = projectType === 'full' ? selectedElements : (projectType ? [projectType] : []);
  
      if (elementsToCalc.length === 0) {
        return { priceLow: 0, priceHigh: 0, daysLow: 0, daysHigh: 0 };
      }
  
      elementsToCalc.forEach(el => {
        const { rawDaysLow, rawDaysHigh, materialCostLow, materialCostHigh } = getElementEstimate(el, sizes[el], tier);
        totalRawDaysLow += rawDaysLow;
        totalRawDaysHigh += rawDaysHigh;
        totalMaterialLow += materialCostLow;
        totalMaterialHigh += materialCostHigh;
      });
  
      let flatLow = 0.5; // Grading prep
      let flatHigh = 1;
      if (conditions.slope) { flatLow += 0.5; flatHigh += 1; }
      if (conditions.tearOut) { flatLow += 0.5; flatHigh += 1; }
      if (conditions.drainage) { flatLow += 0.5; flatHigh += 0.5; }
  
      totalRawDaysLow += flatLow;
      totalRawDaysHigh += flatHigh;
  
      let multiplier = 1;
      if (conditions.access) multiplier += 0.20;
      if (conditions.levels) multiplier += 0.15;
  
      let finalDaysLow = Math.ceil((totalRawDaysLow * multiplier) * 2) / 2;
      let finalDaysHigh = Math.ceil((totalRawDaysHigh * multiplier) * 2) / 2;
  
      let complexityUplift = 1;
      if (tier === 'better') complexityUplift = 1.15;
      if (tier === 'best') complexityUplift = 1.35;
  
      let labourLow = finalDaysLow * 3000 * complexityUplift;
      let labourHigh = finalDaysHigh * 3000 * complexityUplift;
  
      let priceLow = Math.round((labourLow + totalMaterialLow) / 500) * 500;
      let priceHigh = Math.round((labourHigh + totalMaterialHigh) / 500) * 500;
  
      const isDeckingProject = projectType === 'deck' || (projectType === 'full' && selectedElements.includes('deck'));
  
      if (isDeckingProject) {
        if (priceLow < 25000) priceLow = 25000;
        if (priceHigh < 25000) priceHigh = 25000;
      } else {
        if (priceLow < 20000) priceLow = 20000;
        if (priceHigh < 20000) priceHigh = 20000;
      }
  
      return {
        priceLow,
        priceHigh,
        daysLow: finalDaysLow,
        daysHigh: finalDaysHigh
      };
    };
  
    return {
      good: calculateTier('good'),
      better: calculateTier('better'),
      best: calculateTier('best'),
    };
  }, [projectType, selectedElements, sizes, conditions]);

  const renderSlider = (id: string, label: string, min: number, max: number, format: (v: number) => string) => (
    <div className="mb-8">
      <div className="flex justify-between items-end mb-4">
        <span className="font-sans text-[13px] text-brand-bone">{label}</span>
        <span className="font-display text-2xl text-brand-gold">{format(sizes[id])}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={sizes[id]}
        onChange={(e) => handleSizeChange(id, Number(e.target.value))}
        className="w-full h-[3px] bg-brand-dark rounded-full appearance-none outline-none accent-brand-gold"
        style={{
          background: `linear-gradient(to right, #D4AF63 ${(sizes[id] - min) / (max - min) * 100}%, #1A1814 ${(sizes[id] - min) / (max - min) * 100}%)`
        }}
      />
    </div>
  );

  const renderDropdown = (id: string, label: string, options: string[]) => (
    <div className="mb-8">
      <label className="block font-sans text-[13px] text-brand-bone mb-4">{label}</label>
      <div className="relative">
        <select
          value={sizes[id]}
          onChange={(e) => handleSizeChange(id, e.target.value)}
          className="w-full bg-brand-dark border border-brand-gold/20 text-brand-bone font-sans text-[15px] p-4 rounded-[2px] appearance-none outline-none focus:border-brand-gold transition-colors"
        >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1.5L6 6.5L11 1.5" stroke="#D4AF63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
  );

  const renderSizeInputs = (type: string) => {
    switch (type) {
      case 'patio':
      case 'stone':
      case 'deck':
      case 'turf':
        return renderSlider(type, 'Approximate Square Footage', 100, 2000, v => `${v} sq ft`);
      case 'wall':
        return (
          <>
            {renderSlider('wall', 'Wall Length', 10, 200, v => `${v} ln ft`)}
            {renderDropdown('wallHeight', 'Wall Height', ['Under 2ft', '2-4ft', '4-6ft', 'Over 6ft'])}
          </>
        );
      case 'steps':
        return renderSlider('steps', 'Number of Steps', 2, 20, v => `${v} steps`);
      case 'kitchen':
        return renderDropdown('kitchen', 'Kitchen Scope', ['Basic', 'Full Build']);
      case 'firepit':
      case 'pergola':
      case 'lighting':
        return renderDropdown(type, 'Project Size', ['Small', 'Medium', 'Large']);
      default:
        return null;
    }
  };

  const nextStep = () => {
    if (step === 1 && !projectType) return;
    if (step === 1 && projectType === 'full' && selectedElements.length === 0) return;
    setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="w-full max-w-[860px] mx-auto px-4 py-16 md:py-24">
      <div className="text-center mb-16">
        <div className="font-sans text-xs tracking-[0.3em] uppercase text-brand-gold mb-6">
          ESTIMATE YOUR PROJECT
        </div>
        <h2 className="font-display text-4xl md:text-6xl leading-[1.2] mb-6 text-brand-bone">
          What Will Your Project Cost?
        </h2>
        <p className="font-sans font-light text-base text-brand-muted max-w-lg mx-auto leading-[1.8]">
          Answer a few questions and get a real ballpark — instantly. No signup, no spam, no obligation.
        </p>
      </div>

      <div className="relative bg-brand-black border border-brand-gold/10 rounded-[2px] p-6 md:p-12 overflow-hidden">
        {/* Step Indicator */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-brand-dark">
          <motion.div 
            className="h-full bg-brand-gold"
            initial={{ width: '20%' }}
            animate={{ width: `${(step / 5) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between items-center mb-12 mt-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center">
              <div className={cn(
                "w-2 h-2 rounded-full transition-colors duration-300",
                step === i ? "bg-brand-gold" : step > i ? "bg-brand-gold/50" : "bg-brand-dark"
              )} />
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="font-display text-3xl text-brand-bone mb-8">What are you looking to build?</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PROJECT_TYPES.map(pt => {
                  const Icon = pt.icon;
                  const isSelected = projectType === pt.id;
                  return (
                    <div
                      key={pt.id}
                      onClick={() => {
                        setProjectType(pt.id);
                        if (pt.id !== 'full') setSelectedElements([]);
                      }}
                      className={cn(
                        "group flex items-center gap-4 p-6 rounded-[2px] border transition-all duration-200 cursor-pointer",
                        isSelected 
                          ? "bg-brand-gold/5 border-brand-gold" 
                          : "bg-brand-dark border-brand-gold/15 hover:border-brand-gold/50 hover:-translate-y-[2px]"
                      )}
                    >
                      <div className="text-brand-gold">
                        <Icon size={24} strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className="font-sans text-[13px] uppercase text-brand-bone tracking-wide mb-1">{pt.label}</div>
                        <div className="font-sans text-[12px] font-light text-brand-muted">{pt.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="font-display text-3xl text-brand-bone mb-8">Let's talk size and scope.</h3>
              
              {projectType === 'full' ? (
                <div className="space-y-8">
                  <p className="font-sans text-[13px] text-brand-muted mb-6">Select all the elements you want to include in your backyard transformation:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {PROJECT_TYPES.filter(pt => pt.id !== 'full').map(pt => (
                      <div
                        key={pt.id}
                        onClick={() => toggleElement(pt.id)}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-[2px] border transition-all duration-200 cursor-pointer",
                          selectedElements.includes(pt.id)
                            ? "bg-brand-gold/10 border-brand-gold"
                            : "bg-brand-dark border-brand-gold/15 hover:border-brand-gold/50"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded-[2px] border flex items-center justify-center transition-colors",
                          selectedElements.includes(pt.id) ? "bg-brand-gold border-brand-gold" : "border-brand-gold/30"
                        )}>
                          {selectedElements.includes(pt.id) && <Check size={14} className="text-brand-black" />}
                        </div>
                        <span className="font-sans text-[13px] text-brand-bone">{pt.label}</span>
                      </div>
                    ))}
                  </div>
                  
                  {selectedElements.length > 0 && (
                    <div className="pt-8 border-t border-brand-gold/10 space-y-12">
                      <h4 className="font-display text-2xl text-brand-bone">Configure Sizes</h4>
                      {selectedElements.map(el => (
                        <div key={el} className="bg-brand-dark/50 p-6 rounded-[2px] border border-brand-gold/5">
                          <h5 className="font-sans text-[10px] uppercase tracking-[0.2em] text-brand-gold mb-6">
                            {PROJECT_TYPES.find(p => p.id === el)?.label}
                          </h5>
                          {renderSizeInputs(el)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-xl">
                  {renderSizeInputs(projectType!)}
                </div>
              )}
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="font-display text-3xl text-brand-bone mb-8">Any special site conditions?</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-8">Select any that apply to your property. These can affect labour time and equipment needs.</p>
              
              <div className="space-y-4">
                {CONDITIONS.map(cond => (
                  <div
                    key={cond.id}
                    onClick={() => toggleCondition(cond.id)}
                    className={cn(
                      "flex items-center gap-4 p-5 rounded-[2px] border transition-all duration-200 cursor-pointer",
                      conditions[cond.id]
                        ? "bg-brand-gold/10 border-brand-gold"
                        : "bg-brand-dark border-brand-gold/20 hover:border-brand-gold/50"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-[2px] border flex items-center justify-center transition-colors",
                      conditions[cond.id] ? "bg-brand-gold border-brand-gold" : "border-brand-gold/30"
                    )}>
                      {conditions[cond.id] && <Check size={14} className="text-brand-black" />}
                    </div>
                    <span className="font-sans text-[13px] text-brand-bone">{cond.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="font-display text-3xl text-brand-bone mb-8">Material Preference</h3>
              <p className="font-sans text-[13px] text-brand-muted mb-12">This helps us set the baseline for your estimate. You can see all tiers in the final results.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {MATERIALS.map(mat => (
                  <div
                    key={mat.id}
                    onClick={() => setMaterial(mat.id)}
                    className={cn(
                      "relative flex flex-col p-8 rounded-[2px] border transition-all duration-200 cursor-pointer",
                      material === mat.id
                        ? "bg-brand-gold/10 border-brand-gold"
                        : "bg-brand-dark border-brand-gold/15 hover:border-brand-gold/50 hover:-translate-y-[2px]",
                      mat.id === 'better' && material !== 'better' && "border-brand-gold/40"
                    )}
                  >
                    {mat.badge && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-gold text-brand-black font-sans text-[9px] uppercase tracking-widest px-3 py-1 rounded-[2px] font-medium">
                        {mat.badge}
                      </div>
                    )}
                    <h4 className="font-display text-2xl text-brand-bone mb-3 text-center">{mat.label}</h4>
                    <p className="font-sans text-[12px] font-light text-brand-muted text-center leading-[1.6]">{mat.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step5"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <h3 className="font-display text-4xl text-brand-bone mb-12 text-center">Your Estimated Investment</h3>
              
              <div className="flex flex-col md:flex-row gap-6 mb-16">
                {[
                  { id: 'good', label: 'Premium Standard', data: estimates.good, desc: ['Standard premium materials', 'Efficient, clean design', 'Built to last'] },
                  { id: 'better', label: 'Elevated Design', data: estimates.better, desc: ['Upgraded materials', 'Added design complexity', 'Standout results'], featured: true },
                  { id: 'best', label: 'Signature Build', data: estimates.best, desc: ['Porcelain or natural stone', 'Full premium collection', 'Custom architectural details'] }
                ].map((tier) => (
                  <div
                    key={tier.id}
                    className={cn(
                      "flex-1 flex flex-col p-8 rounded-[2px] border transition-all duration-300",
                      tier.featured ? "bg-brand-dark border-brand-gold shadow-[0_10px_40px_rgba(212,175,99,0.1)] md:-mt-4 md:mb-4" : "bg-brand-dark border-brand-gold/15",
                      tier.id === 'best' && "border-brand-gold/40",
                      material === tier.id && !tier.featured && "border-brand-gold/50 bg-brand-gold/5"
                    )}
                  >
                    <div className="font-sans text-xs uppercase tracking-[0.2em] text-brand-muted mb-4 text-center">
                      {tier.label}
                    </div>
                    <div className="font-display text-3xl lg:text-5xl text-brand-gold mb-6 text-center">
                      ${(tier.data.priceLow / 1000).toFixed(0)}k – ${(tier.data.priceHigh / 1000).toFixed(0)}k
                    </div>
                    <ul className="space-y-3 mb-8 flex-1">
                      {tier.desc.map((d, i) => (
                        <li key={i} className="flex items-start gap-3 text-brand-bone font-sans text-[13px] font-light">
                          <div className="mt-1 w-1 h-1 bg-brand-gold rounded-full shrink-0" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-6 border-t border-brand-gold/10 font-sans text-[12px] font-light text-brand-muted italic text-center">
                      Estimated {tier.data.daysLow}–{tier.data.daysHigh} days on-site
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center max-w-2xl mx-auto bg-brand-dark p-6 md:p-8 rounded-[2px] border border-brand-gold/10">
                <p className="font-display text-2xl md:text-4xl text-brand-bone mb-6">
                  These are ballpark estimates. <br/><span className="text-brand-gold italic">Every property is different.</span>
                </p>
                <p className="font-sans text-base font-light text-brand-muted mb-10 leading-[1.8]">
                  A discovery call gives you exact numbers — materials, timeline, and scope — before any work begins. <span className="text-brand-gold font-normal">15 minutes, free, no pressure.</span>
                </p>
                <div className="flex flex-col items-center justify-center gap-6">
                  <a href="#process" className="btn-primary w-full md:w-auto py-5 px-12 tracking-widest">Book Free Discovery Call →</a>
                  <a href="tel:7055003581" className="font-sans text-sm text-brand-gold hover:text-brand-gold/80 transition-colors flex items-center gap-3">
                    <Phone size={16} />
                    <span>Speak with a Designer: 705-500-3581</span>
                  </a>
                </div>
              </div>

              <div className="mt-16 text-center">
                <button onClick={() => setStep(1)} className="btn-ghost text-[9px] py-3 px-6">Start Over</button>
              </div>

              <p className="mt-12 font-sans text-xs font-light text-brand-dim text-center max-w-3xl mx-auto leading-[1.6]">
                Estimates are based on typical project parameters for Simcoe County. <span className="text-brand-gold font-normal">{(projectType === 'deck' || selectedElements.includes('deck')) ? "Decking projects require a minimum $25,000 investment." : "Hardscape projects require a minimum $20,000 investment."}</span> Final pricing depends on site conditions, material availability, and project scope. Book a free discovery call for an accurate architectural quote.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {step < 5 && (
          <div className="mt-12 pt-8 border-t border-brand-gold/10 flex justify-between items-center">
            {step > 1 ? (
              <button onClick={prevStep} className="btn-ghost">← Back</button>
            ) : <div />}
            <button 
              onClick={nextStep} 
              className={cn("btn-primary", (step === 1 && !projectType) || (step === 1 && projectType === 'full' && selectedElements.length === 0) ? "opacity-50 cursor-not-allowed" : "")}
              disabled={(step === 1 && !projectType) || (step === 1 && projectType === 'full' && selectedElements.length === 0)}
            >
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
