// @ts-nocheck
// Exact compiled construction rules extracted from the user-provided reference.
// No price book, prices, quote functions or commercial rates are imported.
// Provenance: outputs/outside-logic-extraction; reference baseline preserved separately.
  // src/lib/deck-engine/config.ts
  var LIMITS = {
    width: { min: 6, max: 40 },
    depth: { min: 6, max: 30 },
    heightIn: { min: 4, max: 144 },
    secondary: { min: 4, max: 30 },
    stairWidthIn: { min: 34, max: 120 },
    railingRequiredAtIn: 24
  };
  function defaultConfig() {
    return {
      shape: "rectangle",
      width: 16,
      depth: 12,
      heightIn: 36,
      secondary: { rw: 8, rd: 8, rh: null, rside: "right", ww: 10 },
      split: { splitD: 8, stepH: 18, splitDir: "front", lowerW: null, splitConn: "auto" },
      house: "wood",
      houseDims: { hw: 40, hd: 30, hOff: 12, wProfile: "straight", wallSteps: [] },
      deckMods: [],
      framing: "PT",
      structural: { joistSz: "2x10", joistSp: "16", beamMount: "drop", bSzSel: "auto", bPlySel: "auto" },
      pictureFrame: true,
      surface: { line: "Summit", colour: "Boulder" },
      railing: { enabled: true, type: "aluminum_picket", colour: "black" },
      stairs: { enabled: false, widthIn: 48, riseTarget: 7, edge: "front", pos: 0, type: "PT", typeExplicit: false, tread: "same", rail: "none" },
      addons: {
        planning: { cad: false, permit: false, render3d: false },
        demolition: { enabled: false, sqft: 0, heightIn: 36, byHomeowner: false },
        stoneBase: false,
        fascia: false,
        skirting: false
      },
      site: { access: "unknown", grade: "unknown", existing: "unknown", interests: [] }
    };
  }
  var clamp = (v, min, max) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
  function clampConfig(c2) {
    const heightIn = clamp(c2.heightIn, LIMITS.heightIn.min, LIMITS.heightIn.max);
    return {
      ...c2,
      width: clamp(c2.width, LIMITS.width.min, LIMITS.width.max),
      depth: clamp(c2.depth, LIMITS.depth.min, LIMITS.depth.max),
      heightIn,
      secondary: { ...c2.secondary, rw: clamp(c2.secondary.rw, LIMITS.secondary.min, LIMITS.secondary.max), rd: clamp(c2.secondary.rd, LIMITS.secondary.min, LIMITS.secondary.max) },
      stairs: { ...c2.stairs, widthIn: clamp(c2.stairs.widthIn, LIMITS.stairWidthIn.min, LIMITS.stairWidthIn.max) },
      railing: { ...c2.railing, enabled: c2.railing.enabled || heightIn >= LIMITS.railingRequiredAtIn }
    };
  }
  function validateConfig(c2) {
    const errors = [];
    const outOfRange = (v, lim) => !Number.isFinite(v) || v < lim.min || v > lim.max;
    if (outOfRange(c2.width, LIMITS.width)) errors.push("width out of range");
    if (outOfRange(c2.depth, LIMITS.depth)) errors.push("depth out of range");
    if (outOfRange(c2.heightIn, LIMITS.heightIn)) errors.push("heightIn out of range");
    if (c2.heightIn >= LIMITS.railingRequiredAtIn && !c2.railing.enabled) errors.push("railing required at 24in and above");
    if (c2.stairs.enabled) {
      const { deckW, deckD } = deckBoundingBox(c2);
      const edgeLen = c2.stairs.edge === "front" ? deckW : deckD;
      if (c2.stairs.widthIn / 12 > edgeLen) errors.push("stairs.widthIn exceeds edge length");
    }
    return errors;
  }
  function deckBoundingBox(c2) {
    if (c2.shape === "L-shape" || c2.shape === "wrap") {
      return { deckW: c2.width + c2.secondary.rw, deckD: Math.max(c2.depth, c2.secondary.rd) };
    }
    if (c2.shape === "split") {
      const lowerW = c2.split.lowerW != null && c2.split.lowerW > 0 ? c2.split.lowerW : c2.width;
      return c2.split.splitDir === "front" ? { deckW: Math.max(c2.width, lowerW), deckD: c2.depth + c2.split.splitD } : { deckW: c2.width + c2.split.splitD, deckD: Math.max(c2.depth, lowerW) };
    }
    return { deckW: c2.width, deckD: c2.depth };
  }
  function toLegacyCfg(c2) {
    return {
      width: c2.width,
      depth: c2.depth,
      heightIn: c2.heightIn,
      house: c2.house,
      joistSp: c2.structural.joistSp,
      joistSz: c2.structural.joistSz,
      beamMount: c2.structural.beamMount,
      bSzSel: c2.structural.bSzSel,
      bPlySel: c2.structural.bPlySel,
      ft: c2.framing,
      pf: c2.pictureFrame,
      shape: c2.shape,
      rw: c2.secondary.rw,
      rd: c2.secondary.rd,
      rh: c2.secondary.rh,
      rside: c2.secondary.rside,
      splitD: c2.split.splitD,
      stepH: c2.split.stepH,
      splitDir: c2.split.splitDir,
      lowerW: c2.split.lowerW,
      splitConn: c2.split.splitConn,
      ww: c2.secondary.ww,
      hw: c2.houseDims.hw,
      hd: c2.houseDims.hd,
      wProfile: c2.houseDims.wProfile,
      wsPos: 10,
      wallSteps: c2.houseDims.wallSteps,
      deckMods: c2.deckMods,
      wsW: 8,
      wsD: 2,
      hOff: c2.houseDims.hOff
    };
  }
  function toStairCfg(c2) {
    return {
      enabled: c2.stairs.enabled,
      widthIn: c2.stairs.widthIn,
      riseTarget: c2.stairs.riseTarget,
      type: c2.stairs.type,
      edge: c2.stairs.edge,
      tread: c2.stairs.tread,
      rail: c2.stairs.rail,
      pos: c2.stairs.pos,
      typeExplicit: c2.stairs.typeExplicit
    };
  }

  // src/lib/deck-engine/constants.ts
  var JSPAN = { "2x8": { "12": 12.25, "16": 11.5 }, "2x10": { "12": 14.5, "16": 13.5 }, "2x12": { "12": 16.5, "16": 15.5 } };
  var CANT = { "2x8": 1.333, "2x10": 2, "2x12": 2 };
  var JH = { "2x8": 0.604, "2x10": 0.771, "2x12": 0.938 };
  var BSPAN = { "2x8": { 2: 5.5, 3: 6.75, 4: 7.75 }, "2x10": { 2: 6.75, 3: 8.25, 4: 9.5 }, "2x12": { 2: 7.75, 3: 9.5, 4: 11 } };
  var BH = { "2x8": 0.604, "2x10": 0.771, "2x12": 0.938 };
  var MAX_PIER = 11.5;
  var BD = 0.083;
  var STEEL_JSPAN = { "12": 14, "16": 12 };
  var STEEL_CANT = 2;
  var STEEL_JH = 0.458;
  var STEEL_BH = 0.875;
  var STEEL_MAX_PIER = 18;
  var STEEL_BSPAN = { 2: 18, 3: 22, 4: 26 };
  var BD_D = 5.5 / 12;
  var GP_D = 0.1875 / 12;
  var SL_D = BD_D + GP_D;

  // src/lib/deck-engine/structure.ts
  function computeStruct(cfg) {
    const h = cfg.heightIn / 12;
    const isLedger = !["brick", "stone"].includes(cfg.house);
    const isSteelFt = cfg.ft === "Steel";
    const FOH_STRUCT = 1.5 / 12;
    const isFlush = cfg.beamMount === "flush";
    const jSpan = isSteelFt ? STEEL_JSPAN[cfg.joistSp] || 12 : JSPAN[cfg.joistSz]?.[cfg.joistSp] || 13.5;
    const cant = isSteelFt ? isFlush ? FOH_STRUCT : STEEL_CANT : isFlush ? FOH_STRUCT : CANT[cfg.joistSz] || 2;
    const jh = isSteelFt ? STEEL_JH : JH[cfg.joistSz] || 0.771;
    const effD = Math.max(0.5, cfg.depth - cant);
    const nSpans = Math.ceil(effD / jSpan);
    const rows = isLedger ? nSpans : 1 + nSpans;
    let bSz, bPly, bh, govSpan;
    if (isSteelFt) {
      bSz = "Fortress 2\xD711";
      bPly = cfg.bPlySel === "auto" ? 2 : parseInt(cfg.bPlySel);
      bh = STEEL_BH;
      govSpan = Math.min(STEEL_BSPAN[bPly] || 18, STEEL_MAX_PIER);
    } else {
      const bSzSel = cfg.bSzSel === "auto" ? null : cfg.bSzSel;
      const bPlySel = cfg.bPlySel === "auto" ? null : parseInt(cfg.bPlySel);
      let best = null;
      if (!bSzSel || !bPlySel) {
        const sizes = ["2x8", "2x10", "2x12"];
        for (const sz of sizes) for (const ply of [2, 3, 4]) {
          const gsp = Math.min(BSPAN[sz][ply], MAX_PIER);
          const spr2 = Math.ceil((cfg.width - 2) / gsp) + 1;
          const th = rows * spr2;
          if (!best || th < best.th || th === best.th && ply === 3 && best.ply !== 3 || th === best.th && ply === best.ply && sizes.indexOf(sz) < sizes.indexOf(best.sz))
            best = { sz, ply, spr: spr2, th, gsp };
        }
      }
      bSz = bSzSel ?? best.sz;
      bPly = bPlySel ?? best.ply;
      bh = BH[bSz] || 0.771;
      govSpan = Math.min(BSPAN[bSz]?.[bPly] || 8.25, MAX_PIER);
    }
    const spr = Math.ceil((cfg.width - 2) / govSpan) + 1;
    const beamRows = [];
    for (let i = 0; i < rows; i++) {
      let z, type = "standard";
      const secZ = effD / nSpans;
      if (isLedger) z = cfg.depth - cant - i * secZ;
      else {
        if (i === 0) {
          z = 0;
          type = "house_beam";
        } else z = cfg.depth - cant - (i - 1) * secZ;
      }
      beamRows.push({ z: Math.max(0.2, Math.min(cfg.depth - 0.2, z)), type });
    }
    const supXs = Array.from({ length: spr }, (_, i) => spr === 1 ? cfg.width / 2 : 1 + i * (cfg.width - 2) / (spr - 1));
    const posts = [];
    for (const br of beamRows) for (const x of supXs) posts.push({ x, z: br.z, type: br.type === "house_beam" ? "mammoth" : "helical" });
    const sp = parseInt(cfg.joistSp);
    const jCount = Math.ceil(cfg.width * 12 / sp) + 1;
    const jXs = Array.from({ length: jCount }, (_, i) => i === jCount - 1 ? cfg.width : i * cfg.width / (jCount - 1));
    const surfY = h - BD;
    let jBotY, bBotY;
    if (cfg.beamMount === "drop") {
      jBotY = surfY - jh;
      bBotY = jBotY - bh;
    } else {
      jBotY = surfY - jh;
      bBotY = surfY - bh;
    }
    const pfMW = isSteelFt ? 2 / 12 : 1.5 / 12;
    const pfGap = isSteelFt ? 0.375 / 12 : 0.875 / 12;
    const pfTotalD = 3 * pfMW + 2 * pfGap;
    const bkrMW = pfMW;
    const bkrGap = isSteelFt ? 0.25 / 12 : 0.375 / 12;
    const bkrTotalD = 4 * bkrMW + 3 * bkrGap;
    let breakerXs = [];
    {
      const BD_D2 = 5.5 / 12, GP_D2 = 0.1875 / 12, SL_D2 = BD_D2 + GP_D2;
      const fxs_d = cfg.pf ? SL_D2 : 0;
      const fxe_d = cfg.width - (cfg.pf ? SL_D2 : 0);
      const fw_d = fxe_d - fxs_d;
      let nb_d = 0;
      while (nb_d < 20 && (fw_d - nb_d * SL_D2) / (nb_d + 1) > 20.001) nb_d++;
      const secW_d = (fw_d - nb_d * SL_D2) / (nb_d + 1);
      breakerXs = [];
      let cx_d = fxs_d;
      for (let s = 0; s <= nb_d; s++) {
        cx_d += secW_d;
        if (s < nb_d) {
          cx_d += GP_D2;
          breakerXs.push(cx_d + BD_D2 / 2);
          cx_d += BD_D2 + GP_D2;
        }
      }
    }
    const joistLabel = isSteelFt ? "Fortress 2\xD76" : cfg.joistSz;
    const beamLabel = isSteelFt ? `${bPly}-Ply Fortress 2\xD711` : `${bPly}-Ply ${bSz.toUpperCase()}`;
    const _hOff2 = ((_v) => isNaN(_v) ? 0 : _v)(+cfg.hOff);
    const _steps = Array.isArray(cfg.wallSteps) && cfg.wProfile === "custom" ? cfg.wallSteps : [];
    const _legacyStep = cfg.wProfile === "stepout" ? [{ type: "stepout", pos: ((_v) => isNaN(_v) ? 10 : _v)(+cfg.wsPos), width: ((_v) => isNaN(_v) ? 8 : _v)(+cfg.wsW), depth: ((_v) => isNaN(_v) ? 2 : _v)(+cfg.wsD) }] : [];
    const _allSteps = [..._steps, ..._legacyStep];
    const notches = _allSteps.filter((s) => s.type === "stepout").map((s) => {
      const nL = Math.max(0, s.pos - _hOff2), nR = Math.min(cfg.width, s.pos + s.width - _hOff2);
      return nL < cfg.width && nR > 0 && s.depth > 0 && s.depth < cfg.depth && nR > nL ? { L: nL, R: nR, D: s.depth } : null;
    }).filter(Boolean);
    const bumpActive = notches.length > 0;
    const notchL = notches[0]?.L ?? null, notchR = notches[0]?.R ?? null, notchD = notches[0]?.D ?? null;
    const baseSqft = cfg.width * cfg.depth;
    const wallNotchSqft = notches.reduce((sum, n) => sum + (n.R - n.L) * n.D, 0);
    const _validDeckMods = Array.isArray(cfg.deckMods) ? cfg.deckMods.filter((d) => d && d.width > 0 && d.depth > 0) : [];
    const deckModAreaDelta = _validDeckMods.reduce((sum, d) => {
      const area = d.width * d.depth;
      return sum + (d.type === "cutout" ? -area : area);
    }, 0);
    const deckModPerimeterDelta = _validDeckMods.reduce((sum, d) => sum + 2 * d.depth, 0);
    const sqftActual = Math.max(0, baseSqft - wallNotchSqft + deckModAreaDelta);
    const perimeterAdjusted = cfg.width + 2 * cfg.depth + deckModPerimeterDelta;
    return { width: cfg.width, depth: cfg.depth, h, houseW: cfg.hw || 40, houseD: cfg.hd || 30, hOff: ((_v) => isNaN(_v) ? 0 : _v)(+cfg.hOff), wProfile: cfg.wProfile || "straight", wsPos: ((_v) => isNaN(_v) ? 10 : _v)(+cfg.wsPos), wsW: ((_v) => isNaN(_v) ? 8 : _v)(+cfg.wsW), wsD: ((_v) => isNaN(_v) ? 2 : _v)(+cfg.wsD), bumpActive, notches, notchL, notchR, notchD, sqftActual, deckMods: _validDeckMods, deckModAreaDelta, perimeterAdjusted, isLedger, jh, bh, bSz, bPly, jSpan, cant, rows, spr, govSpan, beamRows, supXs, posts, jXs, jCount, jBotY, bBotY, surfY, helicals: posts.filter((p) => p.type === "helical").length, mammoths: posts.filter((p) => p.type === "mammoth").length, sp, cfg, pfMW, pfGap, pfTotalD, bkrMW, bkrGap, bkrTotalD, breakerXs, joistLabel, beamLabel };
  }
  function computeDeckModsImpact(mods) {
    const arr = Array.isArray(mods) ? mods : [];
    let areaDelta = 0;
    let perimeterDelta = 0;
    for (const d of arr) {
      if (!d || !(d.width > 0) || !(d.depth > 0)) continue;
      const area = d.width * d.depth;
      if (d.type === "bumpout") {
        areaDelta += area;
        perimeterDelta += 2 * d.depth;
      } else if (d.type === "cutout") {
        areaDelta -= area;
        perimeterDelta += 2 * d.depth;
      }
    }
    return { areaDelta, perimeterDelta };
  }
  function computeLShape(cfg) {
    const stA = computeStruct(cfg);
    const sectionBHeight = typeof cfg.rh === "number" && cfg.rh > 0 ? cfg.rh : cfg.heightIn;
    const cfgB = { ...cfg, width: cfg.rw, depth: cfg.rd, heightIn: sectionBHeight };
    const stB = computeStruct(cfgB);
    const bW = cfg.width + cfg.rw, bD = Math.max(cfg.depth, cfg.rd);
    const bOffX = cfg.rside === "right" ? cfg.width : 0;
    const aOffX = cfg.rside === "right" ? 0 : cfg.rw;
    const _lDeckMods = computeDeckModsImpact(cfg.deckMods);
    const baseLSqft = cfg.width * cfg.depth + cfg.rw * cfg.rd;
    const totalLSqft = Math.max(0, baseLSqft + _lDeckMods.areaDelta);
    const lPerimeterAdjusted = cfg.width + cfg.rw + cfg.depth + cfg.rd + _lDeckMods.perimeterDelta;
    return {
      ...stA,
      // base props for backwards compat
      shape: "L-shape",
      sectionA: stA,
      sectionB: stB,
      w1: cfg.width,
      d1: cfg.depth,
      w2: cfg.rw,
      d2: cfg.rd,
      bW,
      bD,
      bOffX,
      aOffX,
      // rendering offsets
      rside: cfg.rside,
      totalSqft: totalLSqft,
      // Adjusted perimeter folds in deckMods. _propComputeAll uses this for
      // fascia / skirt / railing pricing on L-shape decks.
      perimeterAdjusted: lPerimeterAdjusted,
      deckMods: Array.isArray(cfg.deckMods) ? cfg.deckMods.slice() : [],
      deckModAreaDelta: _lDeckMods.areaDelta,
      // Override so callers that use width/depth for scaling get bounding box
      width: bW,
      depth: bD,
      // Sum foundation counts across BOTH sections so callers that read the
      // top-level helicals / mammoths (foundation pricing in quickPrice, the
      // scope of work text, the admin spec strip) see the full deck total —
      // not just Section A. The `...stA` spread above brings in stA.helicals,
      // we override it here with the proper sum.
      helicals: (stA.helicals || 0) + (stB.helicals || 0),
      mammoths: (stA.mammoths || 0) + (stB.mammoths || 0),
      cfg: { ...cfg, shape: "L-shape" }
    };
  }
  function computeWrapAround(cfg) {
    const base = computeLShape(cfg);
    return { ...base, shape: "wrap", wrapWallW: cfg.ww || 10 };
  }
  function computeSplitLevel(cfg) {
    const stepH = ((_v) => isNaN(_v) || _v <= 0 ? 18 : _v)(+cfg.stepH);
    const lowerHeightIn = Math.max(0, cfg.heightIn - stepH);
    const isFront = (cfg.splitDir || "front") === "front";
    const stA = computeStruct(cfg);
    const lowerWidth = typeof cfg.lowerW === "number" && cfg.lowerW > 0 ? cfg.lowerW : cfg.width;
    const cfgB = isFront ? { ...cfg, width: lowerWidth, depth: cfg.splitD, heightIn: lowerHeightIn } : { ...cfg, width: cfg.splitD, depth: lowerWidth, heightIn: lowerHeightIn };
    const stB = computeStruct(cfgB);
    const STEP_RISE_MAX = 8;
    const conn = cfg.splitConn || "auto";
    const needsStairs = conn === "steps" ? true : conn === "threshold" ? false : stepH > STEP_RISE_MAX;
    const stepCount = needsStairs ? Math.max(2, Math.ceil(stepH / 7.5)) : 1;
    const interSectionStairs = needsStairs ? {
      rises: stepCount,
      riseEachIn: stepH / stepCount,
      runFt: (stepCount - 1) * 11 / 12,
      // 11" tread per rise
      widthIn: 48,
      // standard 48" wide between split sections
      totalRiseIn: stepH
    } : null;
    const totalW = isFront ? Math.max(cfg.width, lowerWidth) : cfg.width + cfg.splitD;
    const totalD = isFront ? cfg.depth + cfg.splitD : Math.max(cfg.depth, lowerWidth);
    const upperSqft = cfg.width * cfg.depth;
    const lowerSqft = isFront ? lowerWidth * cfg.splitD : cfg.splitD * lowerWidth;
    const _spDeckMods = computeDeckModsImpact(cfg.deckMods);
    const totalSqftActual = Math.max(0, upperSqft + lowerSqft + _spDeckMods.areaDelta);
    const baseSplitPerimeter = isFront ? cfg.width + lowerWidth + 2 * (cfg.depth + cfg.splitD) : cfg.width + cfg.splitD + 2 * Math.max(cfg.depth, lowerWidth);
    const splitPerimeterAdjusted = baseSplitPerimeter + _spDeckMods.perimeterDelta;
    return {
      ...stA,
      shape: "split",
      splitDir: cfg.splitDir || "front",
      sectionA: stA,
      sectionB: stB,
      upperDepth: cfg.depth,
      lowerDepth: cfg.splitD,
      upperWidth: cfg.width,
      lowerWidth: isFront ? lowerWidth : cfg.splitD,
      totalDepth: totalD,
      totalWidth: totalW,
      upperHeightIn: cfg.heightIn,
      lowerHeightIn,
      stepHeightIn: stepH,
      width: totalW,
      depth: totalD,
      totalSqft: totalSqftActual,
      // Adjusted perimeter folds in deckMods so fascia / skirt / railing
      // pricing in _propComputeAll picks them up on split-level decks too.
      perimeterAdjusted: splitPerimeterAdjusted,
      deckMods: Array.isArray(cfg.deckMods) ? cfg.deckMods.slice() : [],
      deckModAreaDelta: _spDeckMods.areaDelta,
      // Inter-section connection. interSectionStairs is null when a single
      // threshold suffices (≤8" rise) or when admin forced threshold mode;
      // otherwise it carries the rise count + tread run + stair width so
      // pricing + scope of work can render and bill correctly.
      interSectionStairs,
      interSectionStepCount: stepCount,
      interSectionNeedsStairs: needsStairs,
      // Sum foundation counts across both upper + lower sections (same fix as
      // L-shape / wrap-around) so foundation pricing and the scope of work
      // count every helical, not just Section A's.
      helicals: (stA.helicals || 0) + (stB.helicals || 0),
      mammoths: (stA.mammoths || 0) + (stB.mammoths || 0),
      cfg: { ...cfg, shape: "split" }
    };
  }
  function computeStructure(cfg) {
    if (cfg.shape === "L-shape") return computeLShape(cfg);
    if (cfg.shape === "wrap") return computeWrapAround(cfg);
    if (cfg.shape === "split") return computeSplitLevel(cfg);
    return computeStruct(cfg);
  }

  // src/lib/deck-engine/stairs.ts
  function computeStairs(st, sc) {
    if (!sc.enabled) return null;
    const userTouchedStType = sc.typeExplicit;
    if (!userTouchedStType && st.cfg && st.cfg.ft) {
      sc = { ...sc, type: st.cfg.ft === "Steel" ? "Steel" : "PT" };
    }
    const W_in = sc.widthIn;
    const H_in = st.cfg.heightIn;
    if (H_in < 6) return null;
    const MAX_RISE = 7.875;
    const TREAD_D = 10.5;
    const BOARD_W = 5.5, GAP = 0.1875, SLOT = BOARD_W + GAP;
    const nRises = Math.ceil(H_in / MAX_RISE);
    const actualRise = H_in / nRises;
    const nTreads = nRises - 1;
    const runTotal_in = nTreads * TREAD_D;
    const runTotal_ft = runTotal_in / 12;
    const W_ft = W_in / 12;
    const stringerLen_ft = Math.sqrt(Math.pow(runTotal_in / 12, 2) + Math.pow(H_in / 12, 2));
    let nStringers;
    if (sc.type === "PT") {
      const clearZone = W_in - 7;
      const addl = Math.max(0, Math.ceil(clearZone / 10) - 1);
      nStringers = 4 + addl;
    } else {
      nStringers = Math.ceil(W_in / 48) * 3;
    }
    const pylexQty = W_in <= 48 ? 2 : 2 + Math.ceil((W_in - 48) / 36);
    const rowsPerTread = Math.ceil(TREAD_D / SLOT);
    const totalTreadRows = rowsPerTread * nTreads;
    const treadLFTotal = totalTreadRows * (W_in / 12);
    const steelZones = Math.ceil(W_in / 48);
    const steelTrays = steelZones;
    const steelStraps = nStringers;
    const steelBotConn = nStringers;
    const labHrs = nRises * (W_in / 48) / 2;
    const warnings = [];
    if (actualRise > MAX_RISE) warnings.push(`Rise ${actualRise.toFixed(2)}" exceeds 7\u215E" max`);
    if (W_in < 34) warnings.push('Stair width < 34" minimum');
    const maxFlightH = 146;
    if (H_in > maxFlightH) warnings.push("Deck height exceeds 12\u2032-2\u2033 \u2014 landing required");
    let startX_ft, startZ_ft, endX_ft, endZ_ft;
    const deckW = st.shape === "L-shape" || st.shape === "wrap" ? st.bW : st.width;
    const deckD = st.shape === "L-shape" || st.shape === "wrap" ? st.bD : st.depth;
    const pos = Math.max(0, sc.pos || 0);
    if (sc.edge === "front") {
      startX_ft = pos;
      startZ_ft = deckD;
      endX_ft = pos + W_ft;
      endZ_ft = deckD + runTotal_ft;
      if (endX_ft > deckW + 0.01) warnings.push(`Stair extends ${(endX_ft - deckW).toFixed(1)}ft past right edge`);
    } else if (sc.edge === "left") {
      startX_ft = -runTotal_ft;
      startZ_ft = pos;
      endX_ft = 0;
      endZ_ft = pos + W_ft;
      if (endZ_ft > deckD + 0.01) warnings.push(`Stair extends ${(endZ_ft - deckD).toFixed(1)}ft past front edge`);
    } else {
      startX_ft = deckW;
      startZ_ft = pos;
      endX_ft = deckW + runTotal_ft;
      endZ_ft = pos + W_ft;
      if (endZ_ft > deckD + 0.01) warnings.push(`Stair extends ${(endZ_ft - deckD).toFixed(1)}ft past front edge`);
    }
    return {
      enabled: true,
      type: sc.type,
      edge: sc.edge,
      tread: sc.tread,
      rail: sc.rail,
      W_in,
      W_ft,
      H_in,
      nRises,
      actualRise,
      nTreads,
      runTotal_in,
      runTotal_ft,
      TREAD_D,
      rowsPerTread,
      stringerLen_ft,
      nStringers,
      pylexQty,
      totalTreadRows,
      treadLFTotal,
      steelZones,
      steelTrays,
      steelStraps,
      steelBotConn,
      labHrs,
      warnings,
      pos,
      edgeLen: sc.edge === "front" ? deckW : deckD,
      // footprint corners
      sx: startX_ft,
      sz: startZ_ft,
      ex: endX_ft,
      ez: endZ_ft
    };
  }

export { LIMITS, defaultConfig, clampConfig, validateConfig, deckBoundingBox, toLegacyCfg, toStairCfg, computeStruct, computeDeckModsImpact, computeLShape, computeWrapAround, computeSplitLevel, computeStructure, computeStairs };
