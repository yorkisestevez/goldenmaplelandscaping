/**
 * Home Depot Canada published CAD retail for framing connectors.
 * Purchasing benchmarks only — not a job-specific supply quote. Confirm stock and finish on order.
 * Checked 2026-10-08 from HD Canada product pages (live / Wayback snapshots where the live page blocks fetch).
 */
export const CONNECTOR_RATE_CHECKED_ON='2026-10-08';
export const CONNECTOR_RATE_SUPPLIER='Home Depot Canada';

export type ConnectorRateSource={
  sku:string;
  model:string;
  unitPrice:number;
  url:string;
  note:string;
};

/** Unit prices used by connectorSchedule (CAD before HST, before material markup). */
export const HOME_DEPOT_CONNECTOR_RATES={
  /** H2.5AZ ea — joist-to-beam / hurricane ties. */
  beamTie:{sku:'1000152530',model:'H2.5AZ',unitPrice:1.76,url:'https://www.homedepot.ca/product/simpson-strong-tie-h2-5a-18-gauge-zmax-galvanized-hurricane-tie/1000152530',note:'Simpson Strong-Tie H2.5A ZMAX hurricane tie, each.'},
  /** BC6Z ea — post-to-beam caps for 6x posts. */
  postCap:{sku:'1001400214',model:'BC6Z',unitPrice:26.75,url:'https://www.homedepot.ca/product/simpson-strong-tie-bc-zmax-galvanized-post-cap-for-6x/1001400214',note:'Simpson Strong-Tie BC ZMAX post cap for 6x; match beam plies on order.'},
  /** A23Z ea — blocking / light angles. */
  blockingAngle:{sku:'1000152082',model:'A23Z',unitPrice:2.28,url:'https://www.homedepot.ca/product/simpson-strong-tie-2-inch-x-1-1-2-inch-x-2-3-4-inch-zmax-galvanized-angle/1000152082',note:'Simpson Strong-Tie A23Z ZMAX angle.'},
  /** LSCZ ea — adjustable stair stringer connectors. */
  stringerConnector:{sku:'1000682318',model:'LSCZ',unitPrice:7.33,url:'https://www.homedepot.ca/product/simpson-strong-tie-lsc-18-gauge-zmax-galvanized-adjustable-stringer-connector/1000682318',note:'Simpson Strong-Tie LSCZ adjustable stringer connector.'},
  /** LSSR26Z ea — field-skewable / slopeable hangers for angled corners. */
  skewedHanger:{sku:'1001683486',model:'LSSR26Z',unitPrice:7.64,url:'https://www.homedepot.ca/product/simpson-strong-tie-lssr-light-field-adjustable-rafter-hanger-for-2x6-nominal-lumber/1001683486',note:'Simpson Strong-Tie LSSR26Z light field-adjustable skewed/sloped hanger for 2x6.'},
  /**
   * DTT2Z kit (CAD 26.23) anchors one railing post; the schedule models four bolt positions per post,
   * so the unit rate is the kit ÷ 4.
   */
  railingPostBolt:{sku:'1001400288',model:'DTT2Z',unitPrice:6.56,url:'https://www.homedepot.ca/product/simpson-strong-tie-dtt-zmax-galvanized-deck-tension-tie-for-2x-with-1-1-2-inch-sds-screws/1001400288',note:'DTT2Z CAD26.23 per post with SDS screws ÷ 4 modeled bolt positions.'},
  /**
   * N8DHDG-R 150-pack CAD 11.77 → planning set of 10 connector nails per connector.
   * 11.77 / 150 × 10 = 0.784… → 0.78.
   */
  fastenerSet:{sku:'1000180642',model:'N8DHDG-R',unitPrice:0.78,url:'https://www.homedepot.ca/product/simpson-strong-tie-strong-drive-1-1-2-in-x-0-131-in-scn-smooth-shank-hdg-connector-nail-150-pack-/1000180642',note:'N8DHDG-R HDG connector nails, 150-pack CAD11.77; 10 nails/set planning allowance.'},
} as const satisfies Record<string,ConnectorRateSource>;

export const hdConnectorBasis=(source:ConnectorRateSource)=>
  `${CONNECTOR_RATE_SUPPLIER} CAD ${source.unitPrice.toFixed(2)} (${source.model} / ${source.sku}); checked ${CONNECTOR_RATE_CHECKED_ON}. ${source.note} Confirm stock and finish on order.`;
