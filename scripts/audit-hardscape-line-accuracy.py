"""Exhaustive per-line/finish coverage report, without claiming guide = recipe.

Run after the importer. All 143 paving lines, including porcelain and overlays,
are audited. Dimensions present is a source-coverage fact, not a purchase or
fabrication approval. Walls are outside this paving-pattern report.
"""
from pathlib import Path
import json,csv,collections
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parents[1]/'outputs/deckcraft-landscape-catalogue'
data=json.loads((ROOT/'public/deckcraft/hardscape-catalogue.json').read_text(encoding='utf8'))
profiles=json.loads((ROOT/'src/data/hardscape-profiles.json').read_text(encoding='utf8'))
manifest=json.loads((ROOT/'scripts/hardscape-pattern-recovery-manifest.json').read_text(encoding='utf8'))
parts=[json.loads((ROOT/'scripts'/name).read_text(encoding='utf8'))for name in manifest['files']]
recovered={(r['productId'],r['finishId'],r['patternId']):r for part in parts for r in part.get('recipes',[])}
recovery=dict(recipes=list(recovered.values()))
genericReferences={'laying-patterns','laying-pattern-sheet','autocad-patterns','autocad-laying-patterns','current-canada-guide-laying-pattern-diagrams','official-product-laying-pattern-diagrams'}
def original_key(product,finish,pattern):
 key=pattern['id'].removeprefix('manufacturer-')
 r=recovered.get((product['id'],finish['id'],key))
 return r['originalPatternId']if r and r.get('originalPatternId')and r['originalPatternId']not in genericReferences else key
rejected={
 'techo-victorien-paver':'Source atlas07 is paired/double herringbone; its full repeat was not digitized. Atlas06 single herringbone is not a substitute.',
 'techo-sleek-paver':'Source atlas03 alternates horizontal and vertical columns. Published811×404mm full stock does not form the schematic2:1 aligned course module at zero joint; a source-backed installed pitch or exact set-out is still required. Atlas04 herringbone is separately recovered with an oblique full-stock repeat.',
 'permacon-esbelto-slab':'PDF14 contains checkerboard/running/third/herringbone, but no parquet. Parquet reference retained guide-only without a separately inspected official drawing.',
 'permacon-esbelto-durafusion-paver':'PDF37 contains checkerboard/running/third/herringbone, but no parquet; no source-backed parquet repeat is asserted.',
 'permacon-mega-melville-slab':'PDF15 original modular diagram includes83%Melville60/17%MegaMelville across products; full mixed-stock binding not digitized. No PDF15 herringbone/third diagram.',
 'permacon-mega-melville-paver':'PDF40 modular diagram includes83%Melville80/17%MegaMelville across products; full mixed-stock binding not digitized. No PDF40 herringbone/third diagram.',
 'permacon-melville-80-small-rectangle-paver':'PDF42 supports linear and axis herringbone only; remaining parquet/third references have no separately inspected drawing.',
 'permacon-zen-paver':'PDF51 shows permeable spacer openings; rectangular nominal stock does not establish the installed spacing/topology or exact mould outline.',
 'techo-antika-paver':'Published source specifies60mm thickness and irregular assorted shapes, without individual length/width or dimensioned mould outline.',
 'oaks-turf-slab':'Canadian product sheet supplies400×600×80mm and40%void area, but full dimensioned opening/mould geometry and an installed repeat are not recovered.',
}
def incomplete_reason(p,f,pattern):
 text=(pattern.get('name','')+' '+pattern.get('id','')).lower()
 units=[u for u in f.get('units',[]) if u.get('widthMm') and u.get('lengthMm') and u.get('heightMm')]
 if pattern.get('evidenceGap'):return str(pattern['evidenceGap'])
 if p['id'] in rejected:return rejected[p['id']]
 if not units:return 'Exact stock length/width/thickness is not published/bound; original repeat cannot safely resolve stock.'
 if any(k in text for k in ['circle','fan','fish','random','radial']):return 'Official reference retained; curved/random layout has no recovered finite stock-bound repeat or per-piece placement schedule.'
 if any(u.get('shape','rectangle') not in ['rectangle','rectangular','rectangular-nominal','square'] for u in units):return 'Official diagram/reference retained; shaped mould/void geometry and stock-to-pattern placement have not both been recovered.'
 if p['brand']=='Oaks':return 'Official Oaks source/laying guide retained; exact original repeat coordinates, stock bindings and numeric installed joint module are not digitized.'
 if len(units)>1:return 'Official source retained; multi-size/thickness or cross-product diagram needs exact stock binding and repeat coordinates. No generic bond is labelled as its original recipe.'
 return 'Official source/name retained; its specific diagram topology/orientation and exact stock repeat have not been independently digitized and bound.'
records=[]
for p in data['products']:
 if p['category']=='wall':continue
 coveredOriginals={original_key(p,f,r)for f in p.get('finishes',[])for r in f.get('patterns',[])if r.get('layout',{} )and r['layout'].get('cells')}
 fs=[]
 for f in p.get('finishes',[]):
  units=[]
  for u in f.get('units',[]):
   dims=[u.get('widthMm'),u.get('lengthMm'),u.get('heightMm')]
   shape=u.get('shape','rectangle')
   family_profiles={key:value['sourceUrl'] for key,value in profiles.items() if key==p['id'] or key.startswith(p['id']+':')}
   mould='nominal rectangular envelope; chamfers, spacers, irregular mould edges are not a fabrication template'
   if shape not in ['rectangle','rectangular','rectangular-nominal','square']:
    mould='source outline available for family; confirm selected unit applicability' if family_profiles else 'original shaped outline/voids not recovered; envelope only'
   units.append(dict(id=u['id'],name=u.get('name'),dimensionsMm=dims,completeDimensions=all(dims),availability=u.get('availability',p.get('availability','supplier confirmation needed')),legacyDiscontinued=u.get('availability')=='discontinued-remaining-stock',sourceUrl=u.get('sourceUrl',p['sourceUrl']),shape=shape,shapeCoverage=mould,shapeSources=family_profiles))
  pats=[]
  for r in f.get('patterns',[]):
   layout=r.get('layout');ready=bool(layout and layout.get('cells'))
   original=original_key(p,f,r);elsewhere=not ready and original in coveredOriginals
   pats.append(dict(id=r['id'],originalReferenceKey=original,name=r.get('name'),sourceUrl=r.get('sourceUrl'),runtimeRecipe=ready,recoveredOnAnotherStockFinish=elsewhere,missingReason=None if ready else 'Original source is recovered on another applicable stock/finish; this finish has no exact recipe binding for that source unit set.'if elsewhere else incomplete_reason(p,f,r),intrinsicAngleDeg=layout.get('angleDeg',0) if ready else None,nominalJointMm=layout.get('jointMm') if ready else None,installationJointMm=layout.get('installationJointMm') if ready else None,jointStatus=layout.get('jointStatus','prior recipe: consult source') if ready else None,cells=len(layout['cells']) if ready else 0,sourceEvidence=r.get('recoveryEvidence')))
  fs.append(dict(id=f['id'],name=f.get('name'),units=units,patterns=pats,retiredUnsupportedOrSupersededReferences=f.get('retiredSourceReferences',[]),defaultPatternId=f.get('defaultPatternId'),documentedStockCount=sum(u['completeDimensions'] for u in units),activeStockCount=sum(u['completeDimensions'] and not u['legacyDiscontinued'] for u in units),legacyStockCount=sum(u['legacyDiscontinued'] for u in units),runtimeRecipeCount=sum(r['runtimeRecipe'] for r in pats),guideOnlyCount=sum(not r['runtimeRecipe'] for r in pats),otherStockFinishReferenceCount=sum(r['recoveredOnAnotherStockFinish']for r in pats)))
 missingOriginals={r['originalReferenceKey']for f in fs for r in f['patterns']if not r['runtimeRecipe']and not r['recoveredOnAnotherStockFinish']}
 records.append(dict(id=p['id'],name=p['name'],brand=p['brand'],category=p['category'],sourceUrl=p['sourceUrl'],finishes=fs,remainingOriginalReferenceKeys=sorted(missingOriginals),dimensionCoverage='all listed units have documented dimensions' if all(u['completeDimensions'] for f in fs for u in f['units']) else 'individual stock dimensions missing',originalPatternCoverage='all retained source references recovered on applicable stock finishes; catalogue exhaustiveness not certified'if coveredOriginals and not missingOriginals else 'partly recovered; remaining original source references explicit'if coveredOriginals else 'no recovered original runtime recipe'))
counts=dict(pavingLines=len(records),brands=dict(collections.Counter(r['brand'] for r in records)),finishes=sum(len(r['finishes']) for r in records),linesWithCompleteListedDimensions=sum(r['dimensionCoverage'].startswith('all') for r in records),linesWithRuntimeRecipes=sum(any(f['runtimeRecipeCount'] for f in r['finishes']) for r in records),runtimeRecipes=sum(f['runtimeRecipeCount'] for r in records for f in r['finishes']),guideOnlyFinishReferences=sum(f['guideOnlyCount'] for r in records for f in r['finishes']),guideReferencesRecoveredOnOtherStockFinish=sum(f['otherStockFinishReferenceCount']for r in records for f in r['finishes']),uniqueRemainingProductSourceReferences=sum(len(r['remainingOriginalReferenceKeys'])for r in records),linesWithAllRetainedSourceReferencesRecovered=sum(r['originalPatternCoverage'].startswith('all')for r in records),linesWithPartlyRecoveredSourceReferences=sum(r['originalPatternCoverage'].startswith('partly')for r in records),linesWithoutRuntimeOriginalRecipes=sum(r['originalPatternCoverage'].startswith('no')for r in records),retiredUnsupportedOrSupersededFinishReferences=sum(len(f['retiredUnsupportedOrSupersededReferences'])for r in records for f in r['finishes']),activeDocumentedPavingUnits=sum(f['activeStockCount'] for r in records for f in r['finishes']),legacyDocumentedPavingUnits=sum(f['legacyStockCount'] for r in records for f in r['finishes']),missingDimensionLines=[r['id'] for r in records if not r['dimensionCoverage'].startswith('all')],newRecipes=len(recovery['recipes']),newRecipeCells=sum(len(r['layout']['cells']) for r in recovery['recipes']),engineeringIndexBytes=(ROOT/'src/data/hardscape-index.json').stat().st_size)
counts['bySupplier']={brand:dict(lines=sum(p['brand']==brand for p in records),runtimeRecipes=sum(f['runtimeRecipeCount']for p in records if p['brand']==brand for f in p['finishes']),allRetainedSourcesRecovered=sum(p['brand']==brand and p['originalPatternCoverage'].startswith('all')for p in records),partlyRecovered=sum(p['brand']==brand and p['originalPatternCoverage'].startswith('partly')for p in records),noRuntimeOriginal=sum(p['brand']==brand and p['originalPatternCoverage'].startswith('no')for p in records),uniqueRemainingSourceReferences=sum(len(p['remainingOriginalReferenceKeys'])for p in records if p['brand']==brand))for brand in sorted(set(p['brand']for p in records))}
counts['withheldSourceInaccurateBindings']=sum(len(part.get('withheldRecipes',[]))for part in parts)
report=dict(verifiedOn=data['verifiedOn'],scope='Every non-wall product and finish in the imported four-supplier catalogue. Completeness means listed dimensions present; installed joints, source moulds, full original pattern lists and Ontario availability remain separate checks.',counts=counts,products=records)
(OUT/'paver-line-accuracy-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
with (OUT/'paver-line-accuracy-audit.csv').open('w',newline='',encoding='utf-8-sig') as stream:
 writer=csv.writer(stream);writer.writerow(['Supplier','Product','Finish','Dimensioned stocks','Legacy stocks','Runtime original recipes','Guide-only references','Product source','Specific remaining evidence'])
 for p in records:
  for f in p['finishes']:
   gaps=list(dict.fromkeys(r['missingReason'] for r in f['patterns'] if not r['runtimeRecipe']))
   writer.writerow([p['brand'],p['name'],f['id'],f['documentedStockCount'],f['legacyStockCount'],f['runtimeRecipeCount'],f['guideOnlyCount'],p['sourceUrl'],' | '.join(gaps) or 'No remaining catalogue guide references; manufacturer catalogue exhaustiveness not asserted.'])
lines=['# DeckCraft paving line accuracy audit','',f"Checked every imported paving line: {counts['pavingLines']} products / {counts['finishes']} finishes across four suppliers. {counts['linesWithCompleteListedDimensions']} lines have dimensions for every listed stock; Techo Antika still lacks individual width/length. {counts['runtimeRecipes']} original stock/finish recipes are available across {counts['linesWithRuntimeRecipes']} lines.",'',f"Of the retained source references, {counts['linesWithAllRetainedSourceReferencesRecovered']} lines have all identified originals recovered on applicable stocks; {counts['linesWithPartlyRecoveredSourceReferences']} are partly recovered and {counts['linesWithoutRuntimeOriginalRecipes']} have no original runtime recipe. There are {counts['uniqueRemainingProductSourceReferences']} unique remaining product source references. The {counts['guideOnlyFinishReferences']} guide-only finish records include {counts['guideReferencesRecoveredOnOtherStockFinish']} originals already recovered for another stock or finish; these are not additional missing manufacturer originals.",'','This audit does **not** certify supplier catalogue exhaustiveness, current availability, irregular mould edges, or every installed joint schedule. Full stock bodies are preserved. Documented joints are used when a verified full-stock module supports them; nominal source-only motifs explicitly retain their joint limitation. Actual source contradictions, unsupported inferred labels, nonapplicable stock bindings, and genuine undigitized drawings are reported separately in the JSON/CSV.','', 'Aberdeen has all five current original patterns, four current stock sizes, and a separate254×762×57mm30×10 legacy unit visibly labelled **Discontinued · remaining stock only**. Current sources specify5mm joints; the recovered mixed-size nominal topology does not prove a reconciled installed5mm module.','',f"Reviewed recovery overlays contain {counts['newRecipes']} exact finish bindings / {counts['newRecipeCells']} full stock cells. The engineering index is {counts['engineeringIndexBytes']:,}bytes; source proofs and limitations remain in the separate public catalogue. {counts['retiredUnsupportedOrSupersededFinishReferences']} unsupported inferred labels or superseded resource placeholders are retained as retired evidence, not counted as missing originals.",'','Oaks Canadian sheets supply19 recovered nominal sizes. Nueva and Colonnade originals have individual source figure inventories; shaded-only source modules are explicitly scoped to their actual highlighted faces. Turf-Slab400×600×80mm/40%void still needs a dimensioned opening profile. The other actual Oaks resource links remain named in the per-line audit.','','| Supplier | Product / finish | Stocks (+legacy) | Original recipes | Guide refs | Source |','|---|---|---:|---:|---:|---|']
for p in records:
 for f in p['finishes']:lines.append(f"| {p['brand']} | {p['name']} / {f['id']} | {f['activeStockCount']} (+{f['legacyStockCount']}) | {f['runtimeRecipeCount']} | {f['guideOnlyCount']} | [Manufacturer]({p['sourceUrl']}) |")
if counts['withheldSourceInaccurateBindings']:
 lines.insert(8,f"{counts['withheldSourceInaccurateBindings']} known source-inaccurate baseline bindings are withheld from runtime; their original guides and exact previous geometry remain as evidence. The correction draft awaits independent source clearance.")
(ROOT.parents[1]/'outputs/deckcraft-paver-line-accuracy-audit.md').write_text('\n'.join(lines)+'\n',encoding='utf8')
print(json.dumps(counts,ensure_ascii=False,indent=2))
