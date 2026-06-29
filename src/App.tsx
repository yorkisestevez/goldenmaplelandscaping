import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import { initAnalytics, trackPageView } from './utils/analytics';
import { initAttributionCapture } from './utils/utmCapture';
import { initBehaviorCapture } from './utils/behavior';

// Eager: Home loads instantly (LCP path)
import Home from './pages/Home';

// Lazy: every other route loads on demand
const Services = lazy(() => import('./pages/Services'));
const Interlocking = lazy(() => import('./pages/services/Interlocking'));
const RetainingWalls = lazy(() => import('./pages/services/RetainingWalls'));
const LandscapeDesign = lazy(() => import('./pages/services/LandscapeDesign'));
const CompositeDecking = lazy(() => import('./pages/services/CompositeDecking'));
const ServiceLocation = lazy(() => import('./pages/services/ServiceLocation'));
const About = lazy(() => import('./pages/About'));
const ServiceAreas = lazy(() => import('./pages/ServiceAreas'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Contact = lazy(() => import('./pages/Contact'));
const Resources = lazy(() => import('./pages/Resources'));
const ProcessPage = lazy(() => import('./pages/ProcessPage'));
const Consultation = lazy(() => import('./pages/process/Consultation'));
const SiteAssessment = lazy(() => import('./pages/process/SiteAssessment'));
const Design3D = lazy(() => import('./pages/process/Design3D'));
const MaterialSelection = lazy(() => import('./pages/process/MaterialSelection'));
const Construction = lazy(() => import('./pages/process/Construction'));
const Completion = lazy(() => import('./pages/process/Completion'));
const BuyersGuide = lazy(() => import('./pages/BuyersGuide'));
const CostEstimator = lazy(() => import('./pages/CostEstimator'));
const CostGuide = lazy(() => import('./pages/CostGuide'));
const CostGuideThankYou = lazy(() => import('./pages/CostGuideThankYou'));
const Book = lazy(() => import('./pages/Book'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const BarrieLanding = lazy(() => import('./pages/locations/Barrie'));
const InnisfilLanding = lazy(() => import('./pages/locations/Innisfil'));
const OroMedonteLanding = lazy(() => import('./pages/locations/OroMedonte'));
const SpringwaterLanding = lazy(() => import('./pages/locations/Springwater'));
const LocationLanding = lazy(() => import('./pages/locations/LocationLanding'));
const InterlockingCostBarrie = lazy(() => import('./pages/blog/InterlockingCostBarrie'));
const WhyPatiosSink = lazy(() => import('./pages/blog/WhyPatiosSink'));
const TimberTechVsWood = lazy(() => import('./pages/blog/TimberTechVsWood'));
const RetainingWallGuide = lazy(() => import('./pages/blog/RetainingWallGuide'));
const ChoosingContractor = lazy(() => import('./pages/blog/ChoosingContractor'));
const PaverComparison = lazy(() => import('./pages/blog/PaverComparison'));
const OutdoorKitchenGuide = lazy(() => import('./pages/blog/OutdoorKitchenGuide'));
const LandscapeLightingGuide = lazy(() => import('./pages/blog/LandscapeLightingGuide'));
const WinterDamagePrevention = lazy(() => import('./pages/blog/WinterDamagePrevention'));
const BackyardROI = lazy(() => import('./pages/blog/BackyardROI'));
const FirePitRegulations = lazy(() => import('./pages/blog/FirePitRegulations'));
const LandscapingCostGuide = lazy(() => import('./pages/blog/LandscapingCostGuide'));
const HiddenCostsCheapLandscaping = lazy(() => import('./pages/blog/HiddenCostsCheapLandscaping'));
const BestTimeInstallPatio = lazy(() => import('./pages/blog/BestTimeInstallPatio'));
const PermitsBylawsBarrie = lazy(() => import('./pages/blog/PermitsBylawsBarrie'));
const PoolDeckMaterials = lazy(() => import('./pages/blog/PoolDeckMaterials'));
const PatioCostFactors = lazy(() => import('./pages/blog/PatioCostFactors'));
const ClearStoneVsGranularA = lazy(() => import('./pages/blog/ClearStoneVsGranularA'));
const PaverWalkwayCostBarrie = lazy(() => import('./pages/blog/PaverWalkwayCostBarrie'));
const PolymericSandVsRegularSandPatio = lazy(() => import('./pages/blog/PolymericSandVsRegularSandPatio'));
const InterlockingDrivewayLifespanOntario = lazy(() => import('./pages/blog/InterlockingDrivewayLifespanOntario'));
const BestPaversPoolDeckSimcoeCounty = lazy(() => import('./pages/blog/BestPaversPoolDeckSimcoeCounty'));
const ConcreteVsInterlockingPatioBarrie = lazy(() => import('./pages/blog/ConcreteVsInterlockingPatioBarrie'));
const NaturalStoneVsPaversBarrie = lazy(() => import('./pages/blog/NaturalStoneVsPaversBarrie'));
const OutdoorLivingPlanningInnisfil = lazy(() => import('./pages/blog/OutdoorLivingPlanningInnisfil'));
const RetainingWallCostOroMedonte = lazy(() => import('./pages/blog/RetainingWallCostOroMedonte'));
const PatiosBarrie = lazy(() => import('./pages/PatiosBarrie'));
const OutdoorLivingBarrie = lazy(() => import('./pages/OutdoorLivingBarrie'));
const LuxuryLandscapeBarrie = lazy(() => import('./pages/LuxuryLandscapeBarrie'));

const RouteFallback = () => (
  <div className="bg-brand-nearblack min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-brand-gold/20 border-t-brand-gold animate-spin" />
  </div>
);

/** Fires GA4 + Meta Pixel page_view on every SPA route change. */
function AnalyticsRouteTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

export default function App() {
  useEffect(() => {
    initAttributionCapture();
    initBehaviorCapture();
    initAnalytics();
  }, []);

  return (
    <HelmetProvider>
      <Router>
        <ScrollToTop />
        <AnalyticsRouteTracker />
        <Layout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/services/interlocking-barrie" element={<Interlocking />} />
              <Route path="/services/retaining-walls-barrie" element={<RetainingWalls />} />
              <Route path="/services/landscape-design-barrie" element={<LandscapeDesign />} />
              <Route path="/services/composite-decking-barrie" element={<CompositeDecking />} />
              {/* Auto-generated Service × Location SEO matrix (28 combos) */}
              <Route path="/services/:slug" element={<ServiceLocation />} />
              <Route path="/about" element={<About />} />
              <Route path="/service-areas" element={<ServiceAreas />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/portfolio/:slug" element={<ProjectDetail />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/resources" element={<Resources />} />
              {/* Process & Subpages */}
              <Route path="/process" element={<ProcessPage />} />
              <Route path="/process/consultation" element={<Consultation />} />
              <Route path="/process/site-assessment" element={<SiteAssessment />} />
              <Route path="/process/3d-design" element={<Design3D />} />
              <Route path="/process/material-selection" element={<MaterialSelection />} />
              <Route path="/process/construction" element={<Construction />} />
              <Route path="/process/completion" element={<Completion />} />
              <Route path="/buyers-guide" element={<BuyersGuide />} />
              <Route path="/cost-estimator" element={<CostEstimator />} />
              {/* Tier-specific landing pages — Foundation / Signature / Premium */}
              <Route path="/patios-barrie" element={<PatiosBarrie />} />
              <Route path="/outdoor-living-barrie" element={<OutdoorLivingBarrie />} />
              <Route path="/luxury-landscape-barrie" element={<LuxuryLandscapeBarrie />} />
              <Route path="/cost-guide" element={<CostGuide />} />
              <Route path="/cost-guide/thank-you" element={<CostGuideThankYou />} />
              <Route path="/book" element={<Book />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              {/* Blog Posts */}
              <Route path="/resources/why-patios-sink-barrie" element={<WhyPatiosSink />} />
              <Route path="/resources/clear-stone-vs-granular-a-base" element={<ClearStoneVsGranularA />} />
              <Route path="/resources/timbertech-vs-wood-decking-ontario" element={<TimberTechVsWood />} />
              <Route path="/resources/retaining-wall-guide-simcoe-county" element={<RetainingWallGuide />} />
              <Route path="/resources/how-to-choose-landscaping-contractor-barrie" element={<ChoosingContractor />} />
              <Route path="/resources/unilock-vs-techo-bloc-vs-permacon" element={<PaverComparison />} />
              <Route path="/resources/outdoor-kitchen-planning-guide" element={<OutdoorKitchenGuide />} />
              <Route path="/resources/landscape-lighting-guide-barrie" element={<LandscapeLightingGuide />} />
              <Route path="/resources/winter-damage-prevention-interlocking" element={<WinterDamagePrevention />} />
              <Route path="/resources/backyard-renovation-roi-ontario" element={<BackyardROI />} />
              <Route path="/resources/fire-pit-regulations-barrie" element={<FirePitRegulations />} />
              <Route path="/resources/landscaping-cost-guide-barrie" element={<LandscapingCostGuide />} />
              <Route path="/resources/hidden-costs-cheap-landscaping" element={<HiddenCostsCheapLandscaping />} />
              <Route path="/resources/interlocking-patio-cost-ontario" element={<PatioCostFactors />} />
              <Route path="/resources/interlocking-cost-barrie" element={<InterlockingCostBarrie />} />
              <Route path="/resources/best-time-install-patio-ontario" element={<BestTimeInstallPatio />} />
              <Route path="/resources/landscape-permits-barrie-simcoe" element={<PermitsBylawsBarrie />} />
              <Route path="/resources/pool-deck-materials-ontario" element={<PoolDeckMaterials />} />
              <Route path="/resources/paver-walkway-cost-barrie" element={<PaverWalkwayCostBarrie />} />
              <Route path="/resources/polymeric-sand-vs-regular-sand-patio" element={<PolymericSandVsRegularSandPatio />} />
              <Route path="/resources/interlocking-driveway-lifespan-ontario" element={<InterlockingDrivewayLifespanOntario />} />
              <Route path="/resources/best-pavers-pool-deck-simcoe-county" element={<BestPaversPoolDeckSimcoeCounty />} />
              <Route path="/resources/concrete-vs-interlocking-patio-barrie" element={<ConcreteVsInterlockingPatioBarrie />} />
              <Route path="/resources/natural-stone-vs-pavers-barrie" element={<NaturalStoneVsPaversBarrie />} />
              <Route path="/resources/outdoor-living-planning-innisfil" element={<OutdoorLivingPlanningInnisfil />} />
              <Route path="/resources/retaining-wall-cost-oro-medonte" element={<RetainingWallCostOroMedonte />} />
              {/* SEO Location Pages */}
              <Route path="/locations/barrie" element={<BarrieLanding />} />
              <Route path="/locations/innisfil" element={<InnisfilLanding />} />
              <Route path="/locations/oro-medonte" element={<OroMedonteLanding />} />
              <Route path="/locations/springwater" element={<SpringwaterLanding />} />
              {/* Auto-generated location landings (Orillia, Wasaga Beach, Midland, Collingwood) */}
              <Route path="/locations/:slug" element={<LocationLanding />} />
              {/* Fallback to Home */}
              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </HelmetProvider>
  );
}
