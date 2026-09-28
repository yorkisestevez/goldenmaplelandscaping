/**
 * The public references the framing engine's numbers come from. Every table in tableData.ts names one of these.
 * The research copies (PDFs, page renders and transcriptions) are summarised in docs/deckcraft/structure-sources.md.
 */
export interface Source{publisher:string;title:string;edition:string;reference:string;url:string}

export const SOURCES={
  obc2024:{
    publisher:'Ontario Ministry of Municipal Affairs and Housing',
    title:'2024 Building Code Compendium, Vol. 1 (O. Reg. 163/24, Division B, Part 9)',
    edition:'January 16, 2025 update; in force January 1, 2025',
    reference:'Tables 9.23.4.2.-A (floor joists) and 9.23.4.2.-H (built-up beams); Article 9.23.9.4 (bridging and blocking)',
    url:'https://www.publications.gov.on.ca/store/20170501121/Free_Download_Files/301880.pdf',
  },
  barrie2026:{
    publisher:'City of Barrie Building Services',
    title:'Deck Specs',
    edition:'Summer 2026',
    reference:'pp. 3–4: joist sizing, 2 ft joist cantilever, 12 in beam cantilever, 6 in post above grade, bridging at 6 ft 11 in',
    url:'https://www.barrie.ca/media/4040',
  },
  springwater2026:{
    publisher:'Township of Springwater',
    title:'Building Guide – Decks',
    edition:'last updated March 3, 2026',
    reference:'p. 9: deck joist span and maximum cantilever; beam span table for a supported joist length up to 3.6 m; 12 in beam cantilever',
    url:'https://www.springwater.ca/media/qkdb5m4z/deck-guide-march-2026.pdf',
  },
  orillia2025:{
    publisher:'City of Orillia',
    title:'Wood Deck – Structural Sizing Tables, OBC 2024',
    edition:'sheets D01a–D01d, July 2025',
    reference:'D01a: joist cantilever at most 1/6 of the joist span',
    url:'https://www.orillia.ca/media/vw2pvzdf/orillia-deck-details-2024-obc.pdf',
  },
} as const satisfies Record<string,Source>;

export type SourceId=keyof typeof SOURCES;
