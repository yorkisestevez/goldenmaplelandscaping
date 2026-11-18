import type {SourceId} from './sources';

/**
 * Span data transcribed from the references in sources.ts, in the units each one publishes. spanTables.ts converts
 * them to whole inches, always rounding down. Do not edit a number here without the source page open:
 * check-deck-structure.ts pins these values.
 *
 * Load basis: 1.9 kPa. That is the Part 9 residential floor load behind the Tables 9.23.4.2 spans, and it governs
 * decks in Barrie. OBC 9.4.2.3.(1) takes the greater of the specified snow load and 1.9 kPa. Barrie has
 * Ss = 2.5 and Sr = 0.4 kPa (SB-1, 2024), so 0.55 × 2.5 + 0.4 = 1.775 kPa. A site where 0.55·Ss + Sr exceeds
 * 1.9 kPa, such as Penetanguishene at 1.94 kPa, is outside these tables.
 */

/**
 * Floor joists, S-P-F No. 1 and No. 2, "with bridging" column, clear span in metres.
 * Barrie's Deck Specs reproduce these values in feet and inches, and Springwater's deck guide cites the same table.
 */
export const JOIST_TABLE={
  source:'obc2024' as SourceId,
  table:'Table 9.23.4.2.-A, S-P-F No. 1/No. 2, with bridging',
  metres:{'2x8':{12:3.81,16:3.58},'2x10':{12:4.44,16:4.17},'2x12':{12:5.01,16:4.71}},
} as const;

/**
 * Hem-Fir and D.Fir-L No. 1/No. 2 joists, "with bridging", metres. The S-P-F with-bridging cells of this national
 * table match OBC 2024 Table 9.23.4.2.-A exactly (North Bay reprint). Hem-Fir and D.Fir-L No. 1/No. 2 with bridging
 * are the same as each other in the BCBC Table A-1 extract of that table. Confirm the OBC 2024 species sheet before
 * a permit; the code reference stays on confirm. Beam spans stay on the S-P-F Table 9.23.4.2.-H.
 */
export const JOIST_TABLE_SPECIES={
  'Hem-Fir':{'2x8':{12:4.00,16:3.76},'2x10':{12:4.66,16:4.38},'2x12':{12:5.26,16:4.94}},
  'D.Fir-L':{'2x8':{12:4.00,16:3.76},'2x10':{12:4.66,16:4.38},'2x12':{12:5.26,16:4.94}},
} as const;

/**
 * Bridging or blocking rows: not more than 2100 mm from each support or from another row (OBC 9.23.9.4.(1)–(3)),
 * which the "with bridging" spans assume. Barrie prints it as 6 ft 11 in.
 */
export const BLOCKING={source:'obc2024' as SourceId,article:'9.23.9.4.(1)–(3)',maxGapMm:2100} as const;

/**
 * Built-up beams, S-P-F No. 1 and No. 2, clear span in metres. Supported length means half the sum of the joist
 * spans on both sides of the beam (note 3); Barrie adds a joist cantilever in full ("half of joist span + cantilever").
 * The code table has no 2-ply column.
 */
export const BEAM_TABLE_3PLY={
  source:'obc2024' as SourceId,
  table:'Table 9.23.4.2.-H, S-P-F No. 1/No. 2, 3-ply',
  supportedLengthM:[2.4,3.0,3.6,4.2,4.8,5.4,6.0],
  metres:{
    '2x8':[3.07,2.85,2.63,2.44,2.28,2.15,2.04],
    '2x10':[3.92,3.52,3.22,2.98,2.79,2.63,2.49],
    '2x12':[4.57,4.09,3.73,3.46,3.23,3.05,2.89],
  },
} as const;

/**
 * 2-ply beams: Springwater's beam span table, for a supported joist length of at most 3.6 m (11 ft 10 in), in
 * feet and inches as published. Past 3.6 m there is no 2-ply value, and the engine uses a 3-ply beam.
 */
export const BEAM_TABLE_2PLY={
  source:'springwater2026' as SourceId,
  table:'Beam Span Table, based on a maximum supported joist length of 3.6 m (11\'10"), 2 ply',
  maxSupportedLengthM:3.6,
  feetInches:{'2x8':[5,10],'2x10':[7,2],'2x12':[8,4]},
} as const;

/**
 * Joist cantilever past a beam. The limit by size is Springwater's "Maximum Cantilever" column, which Severn,
 * Innisfil, Oro-Medonte, Collingwood and the Canadian Wood Council also publish. Barrie's 2 ft is within it for
 * 2x10 and 2x12. The ratio to the joist span is Orillia's OBC 2024 sheet D01a.
 */
export const JOIST_CANTILEVER={
  source:'springwater2026' as SourceId,
  maxIn:{'2x8':16,'2x10':24,'2x12':24},
  ratioSource:'orillia2025' as SourceId,
  maxFractionOfSpan:1/6,
} as const;

/** Beam cantilever past its end post: 12 in (Barrie and Springwater). */
export const BEAM_CANTILEVER={source:'barrie2026' as SourceId,maxIn:12} as const;
