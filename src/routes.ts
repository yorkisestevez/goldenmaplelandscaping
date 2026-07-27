import { type RouteConfig, index, route } from '@react-router/dev/routes';

// Mirrors the former <Routes> tree in App.tsx. In framework mode RR7 code-splits
// each route module automatically (no manual React.lazy needed).
export default [
  index('pages/Home.tsx'),

  // Services
  route('services', 'pages/Services.tsx'),
  route('services/interlocking-barrie', 'pages/services/Interlocking.tsx'),
  route('services/retaining-walls-barrie', 'pages/services/RetainingWalls.tsx'),
  route('services/landscape-design-barrie', 'pages/services/LandscapeDesign.tsx'),
  route('services/composite-decking-barrie', 'pages/services/CompositeDecking.tsx'),
  route('services/:slug', 'pages/services/ServiceLocation.tsx'),

  // Core pages
  route('about', 'pages/About.tsx'),
  route('service-areas', 'pages/ServiceAreas.tsx'),
  route('portfolio', 'pages/Portfolio.tsx'),
  route('portfolio/:slug', 'pages/ProjectDetail.tsx'),
  route('contact', 'pages/Contact.tsx'),
  route('resources', 'pages/Resources.tsx'),

  // Process
  route('process', 'pages/ProcessPage.tsx'),
  route('process/consultation', 'pages/process/Consultation.tsx'),
  route('process/site-assessment', 'pages/process/SiteAssessment.tsx'),
  route('process/3d-design', 'pages/process/Design3D.tsx'),
  route('process/material-selection', 'pages/process/MaterialSelection.tsx'),
  route('process/construction', 'pages/process/Construction.tsx'),
  route('process/completion', 'pages/process/Completion.tsx'),

  // Lead / cost
  route('buyers-guide', 'pages/BuyersGuide.tsx'),
  route('cost-estimator', 'pages/CostEstimator.tsx'),
  route('cost-guide', 'pages/CostGuide.tsx'),
  route('cost-guide/thank-you', 'pages/CostGuideThankYou.tsx'),
  route('book', 'pages/Book.tsx'),

  // Tier landing pages
  route('patios-barrie', 'pages/PatiosBarrie.tsx'),
  route('outdoor-living-barrie', 'pages/OutdoorLivingBarrie.tsx'),
  route('premium-patio-rebuild-barrie', 'pages/PremiumPatioRebuildBarrie.tsx'),
  route('sloped-backyard-solutions-barrie', 'pages/SlopedBackyardSolutionsBarrie.tsx'),
  route('full-backyard-transformations-barrie', 'pages/FullBackyardTransformationsBarrie.tsx'),
  route('luxury-landscape-barrie', 'pages/LuxuryLandscapeBarrie.tsx'),

  // Legal
  route('privacy', 'pages/Privacy.tsx'),
  route('terms', 'pages/Terms.tsx'),

  // Blog posts
  route('resources/why-patios-sink-barrie', 'pages/blog/WhyPatiosSink.tsx'),
  route('resources/clear-stone-vs-granular-a-base', 'pages/blog/ClearStoneVsGranularA.tsx'),
  route('resources/timbertech-vs-wood-decking-ontario', 'pages/blog/TimberTechVsWood.tsx'),
  route('resources/retaining-wall-guide-simcoe-county', 'pages/blog/RetainingWallGuide.tsx'),
  route('resources/how-to-choose-landscaping-contractor-barrie', 'pages/blog/ChoosingContractor.tsx'),
  route('resources/unilock-vs-techo-bloc-vs-permacon', 'pages/blog/PaverComparison.tsx'),
  route('resources/outdoor-kitchen-planning-guide', 'pages/blog/OutdoorKitchenGuide.tsx'),
  route('resources/landscape-lighting-guide-barrie', 'pages/blog/LandscapeLightingGuide.tsx'),
  route('resources/winter-damage-prevention-interlocking', 'pages/blog/WinterDamagePrevention.tsx'),
  route('resources/backyard-renovation-roi-ontario', 'pages/blog/BackyardROI.tsx'),
  route('resources/fire-pit-regulations-barrie', 'pages/blog/FirePitRegulations.tsx'),
  route('resources/landscaping-cost-guide-barrie', 'pages/blog/LandscapingCostGuide.tsx'),
  route('resources/hidden-costs-cheap-landscaping', 'pages/blog/HiddenCostsCheapLandscaping.tsx'),
  route('resources/interlocking-patio-cost-ontario', 'pages/blog/PatioCostFactors.tsx'),
  route('resources/interlocking-cost-barrie', 'pages/blog/InterlockingCostBarrie.tsx'),
  route('resources/best-time-install-patio-ontario', 'pages/blog/BestTimeInstallPatio.tsx'),
  route('resources/landscape-permits-barrie-simcoe', 'pages/blog/PermitsBylawsBarrie.tsx'),
  route('resources/pool-deck-materials-ontario', 'pages/blog/PoolDeckMaterials.tsx'),
  route('resources/paver-walkway-cost-barrie', 'pages/blog/PaverWalkwayCostBarrie.tsx'),
  route('resources/polymeric-sand-vs-regular-sand-patio', 'pages/blog/PolymericSandVsRegularSandPatio.tsx'),
  route('resources/interlocking-driveway-lifespan-ontario', 'pages/blog/InterlockingDrivewayLifespanOntario.tsx'),
  route('resources/best-pavers-pool-deck-simcoe-county', 'pages/blog/BestPaversPoolDeckSimcoeCounty.tsx'),
  route('resources/concrete-vs-interlocking-patio-barrie', 'pages/blog/ConcreteVsInterlockingPatioBarrie.tsx'),
  route('resources/natural-stone-vs-pavers-barrie', 'pages/blog/NaturalStoneVsPaversBarrie.tsx'),
  route('resources/outdoor-living-planning-innisfil', 'pages/blog/OutdoorLivingPlanningInnisfil.tsx'),
  route('resources/retaining-wall-cost-oro-medonte', 'pages/blog/RetainingWallCostOroMedonte.tsx'),
  route('resources/retaining-wall-engineer-required-ontario', 'pages/blog/RetainingWallEngineerRequiredOntario.tsx'),
  route('resources/backyard-drainage-solutions-barrie', 'pages/blog/BackyardDrainageSolutionsBarrie.tsx'),
  route('resources/best-month-landscaping-project-barrie', 'pages/blog/BestMonthLandscapingProjectBarrie.tsx'),
  route('resources/spring-cleanup-checklist-barrie', 'pages/blog/SpringCleanupChecklistBarrie.tsx'),
  route('resources/composite-decking-maintenance-ontario', 'pages/blog/CompositeDeckingMaintenanceOntario.tsx'),

  // Locations
  route('locations/barrie', 'pages/locations/Barrie.tsx'),
  route('locations/innisfil', 'pages/locations/Innisfil.tsx'),
  route('locations/oro-medonte', 'pages/locations/OroMedonte.tsx'),
  route('locations/springwater', 'pages/locations/Springwater.tsx'),
  route('locations/:slug', 'pages/locations/LocationLanding.tsx'),
] satisfies RouteConfig;
