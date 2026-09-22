/**
 * Render scripts/photos/shortlist.json as a review sheet grouped by proposed project.
 *   node scripts/photos/shortlist-sheet.mjs   → docs/portfolio/shortlist-<date>.jpg
 */
import sharp from 'sharp';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const index = JSON.parse(readFileSync(join(ROOT, 'sources/meta/index.json'), 'utf8'));
const shortlist = JSON.parse(readFileSync(join(ROOT, 'scripts/photos/shortlist.json'), 'utf8'));
const byN = new Map(index.items.filter((i) => i.n).map((i) => [i.n, i]));

const TW = 300, TH = 225, PAD = 10, LABEL = 34, HEAD = 34, COLS = 5;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tiles = [];
let y = PAD;
for (const g of shortlist.groups) {
  const head = Buffer.from(`<svg width="${PAD + COLS * (TW + PAD) - PAD}" height="${HEAD}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#12241C"/><text x="8" y="22" font-family="Arial" font-size="15" fill="#D4AF63" font-weight="bold">${esc(g.title)}  ·  ${esc(g.category)}  ·  ${esc(g.town)}  ·  sheet #${g.sheet.join(', #')}</text></svg>`);
  tiles.push({ input: head, left: PAD, top: y });
  y += HEAD + 6;
  for (let i = 0; i < g.sheet.length; i++) {
    const it = byN.get(g.sheet[i]);
    if (!it) { console.error(`sheet #${g.sheet[i]} not in index`); continue; }
    const file = join(ROOT, 'sources/meta', `${it.id}.jpg`);
    if (!existsSync(file)) { console.error(`missing ${file}`); continue; }
    const buf = await sharp(file).resize(TW, TH, { fit: 'cover', position: 'attention' }).jpeg({ quality: 78 }).toBuffer();
    const label = Buffer.from(`<svg width="${TW}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#1B2620"/><text x="6" y="14" font-family="Arial" font-size="12" fill="#F4EFE6" font-weight="bold">#${it.n}  ${it.source === 'instagram' ? 'IG' : 'FB'} ${it.date}  ${it.width}x${it.height}</text><text x="6" y="28" font-family="Arial" font-size="10" fill="#D4AF63">${i === 0 ? 'COVER' : `photo ${i + 1}`}</text></svg>`);
    const tile = await sharp({ create: { width: TW, height: TH + LABEL, channels: 3, background: '#111' } }).composite([{ input: buf, top: 0, left: 0 }, { input: label, top: TH, left: 0 }]).jpeg().toBuffer();
    tiles.push({ input: tile, left: PAD + (i % COLS) * (TW + PAD), top: y + Math.floor(i / COLS) * (TH + LABEL + PAD) });
  }
  y += Math.ceil(g.sheet.length / COLS) * (TH + LABEL + PAD) + 10;
}
const W = PAD + COLS * (TW + PAD);
const out = join(ROOT, 'docs/portfolio', `shortlist-${new Date().toISOString().slice(0, 10)}.jpg`);
await sharp({ create: { width: W, height: y + PAD, channels: 3, background: '#F3EEE3' } }).composite(tiles).jpeg({ quality: 80 }).toFile(out);
console.log(`shortlist sheet: ${out} (${shortlist.groups.length} groups, ${shortlist.groups.reduce((n, g) => n + g.sheet.length, 0)} photos)`);
