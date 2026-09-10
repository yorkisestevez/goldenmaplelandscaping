import React from 'react';
import { DeckData } from '../types';
import { getStairPlacement, getStairRect, getMaterialFallbackColor } from '../lib/deckGeometry';

interface DeckDiagramProps {
  data: DeckData;
}

export const DeckDiagram: React.FC<DeckDiagramProps> = ({ data }) => {
  const widthFt = Number(data?.width) || 0;
  const depthFt = Number(data?.length) || 0;
  
  if (widthFt <= 0 || depthFt <= 0) {
    return (
      <div className="w-full bg-brand-surface rounded-3xl border-2 border-brand-dim/50 overflow-hidden flex flex-col shadow-sm p-8 items-center justify-center text-brand-muted min-h-[300px]">
        <span className="text-3xl mb-3">📐</span>
        <p className="font-medium">Please enter valid deck dimensions to view the plan.</p>
      </div>
    );
  }

  // Scale for SVG viewbox (1 unit = 1 inch)
  const viewBoxWidth = widthFt * 12;
  const viewBoxHeight = depthFt * 12;
  
  const boardWidth = 5.5;
  const gap = 0.25;
  const step = boardWidth + gap;
  
  let pfBoards = 0;
  if (data.pattern === 'Picture Frame') pfBoards = 1;
  
  const pfThickness = pfBoards * step;
  
  const maxDim = Math.max(widthFt, depthFt);
  const breaker_rows = Math.floor(maxDim / 20);
  const needsBreaker = breaker_rows > 0;
  
  const boardColor = getMaterialFallbackColor(data.deckingMaterial);
  const gapColor = '#0f172a'; // slate-900 (darker for realistic gaps)
  const margin = Math.max(viewBoxWidth, viewBoxHeight) * 0.20; // 20% margin for dimensions and stairs
  
  const fontSize = Math.max(viewBoxWidth, viewBoxHeight) * 0.035;
  const strokeW = Math.max(viewBoxWidth, viewBoxHeight) * 0.004;

  const isWidthBreaker = widthFt >= depthFt;
  const breakerPositions: number[] = [];
  if (needsBreaker) {
    const dim = isWidthBreaker ? viewBoxWidth : viewBoxHeight;
    const spacing = dim / (breaker_rows + 1);
    for (let i = 1; i <= breaker_rows; i++) {
      breakerPositions.push(i * spacing);
    }
  }

  const boardsPerBreaker = (data.pattern === 'Straight' || data.pattern === 'Picture Frame') ? 1 : 2;
  const breakerThickness = boardsPerBreaker * boardWidth + (boardsPerBreaker - 1) * gap;
  
  const getPatternId = () => {
    if (data.pattern === 'Diagonal') return 'pattern-diagonal';
    if (data.pattern === 'Herringbone') return 'pattern-herringbone';
    return 'pattern-horizontal';
  };

  // Stair Calculations — placement math shared with the 3D viewer
  const stairDepth = 36; // arbitrary visual depth for the stairs
  const stairPlacement = getStairPlacement(data, { w: viewBoxWidth, h: viewBoxHeight });
  const hasStairs = stairPlacement !== null;
  const stairW = stairPlacement?.width ?? (data.stairWidth || 48);
  const stairRect = stairPlacement
    ? getStairRect(stairPlacement, stairDepth)
    : { x: 0, y: 0, w: stairW, h: stairDepth };
  const stairX = stairRect.x;
  const stairY = stairRect.y;
  const stairW_svg = stairRect.w;
  const stairH_svg = stairRect.h;

  // Railing Calculations
  const hasRailing = data.railingType !== 'None';
  const railingInset = 3;
  const railingThickness = 3;
  const railingColor = data.railingType === 'Wood Picket' ? boardColor : 
                       data.railingType === 'Aluminum' ? '#1e293b' : 
                       data.railingType === 'Glass Panels' ? '#bae6fd' : '#94a3b8';
  
  return (
    <div className="w-full bg-brand-surface rounded-3xl border-2 border-brand-dim/50 overflow-hidden flex flex-col shadow-sm">
      <div className="p-5 border-b border-white/5 bg-brand-midsurface/40 flex justify-between items-center">
        <h3 className="font-bold text-brand-bonewhite flex items-center gap-2">
          <span className="text-xl">📐</span> Realistic Deck Plan
        </h3>
        <div className="flex gap-4 text-xs font-medium text-brand-muted">
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm shadow-sm" style={{backgroundColor: boardColor}}></div> 
            {data.deckingMaterial}
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-800 shadow-sm"></div> 
            {data.pattern}
          </span>
        </div>
      </div>
      
      <div className="p-8 relative w-full aspect-square md:aspect-video flex items-center justify-center bg-[#f8fafc] overflow-hidden">
        {/* Grid Background */}
        <div 
          className="absolute inset-0 opacity-[0.04]" 
          style={{ 
            backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', 
            backgroundSize: '40px 40px' 
          }}
        ></div>
        
        <svg 
          viewBox={`0 0 ${viewBoxWidth + margin * 2} ${viewBoxHeight + margin * 2}`} 
          className="w-full h-full drop-shadow-2xl relative z-10"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        >
          <defs>
            {/* Board Bevel Gradient - Vertical (for horizontal boards) */}
            <linearGradient id="bevel-v" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
              <stop offset="15%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="85%" stopColor="#000000" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
            </linearGradient>
            
            {/* Board Bevel Gradient - Horizontal (for vertical boards) */}
            <linearGradient id="bevel-h" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
              <stop offset="15%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="85%" stopColor="#000000" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
            </linearGradient>

            {/* Wood Grain Filter */}
            <filter id="wood-grain" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.01 0.15" numOctaves="3" result="noise" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.12 0" in="noise" result="coloredNoise" />
              <feBlend in="SourceGraphic" in2="coloredNoise" mode="multiply" />
            </filter>

            {/* Horizontal Pattern */}
            <pattern id="pattern-horizontal" width={viewBoxWidth} height={step} patternUnits="userSpaceOnUse">
              <rect width={viewBoxWidth} height={boardWidth} fill={boardColor} filter="url(#wood-grain)" />
              <rect width={viewBoxWidth} height={boardWidth} fill="url(#bevel-v)" />
              <rect y={boardWidth} width={viewBoxWidth} height={gap} fill={gapColor} />
              {/* Faux board seams */}
              <line x1={viewBoxWidth * 0.33} y1={0} x2={viewBoxWidth * 0.33} y2={boardWidth} stroke={gapColor} strokeWidth={gap} opacity={0.7} />
              <line x1={viewBoxWidth * 0.66} y1={0} x2={viewBoxWidth * 0.66} y2={boardWidth} stroke={gapColor} strokeWidth={gap} opacity={0.7} />
            </pattern>
            
            {/* Diagonal Pattern */}
            <pattern id="pattern-diagonal" width={step * 2.828} height={step * 2.828} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width={viewBoxWidth * 3} height={boardWidth} fill={boardColor} filter="url(#wood-grain)" />
              <rect width={viewBoxWidth * 3} height={boardWidth} fill="url(#bevel-v)" />
              <rect y={boardWidth} width={viewBoxWidth * 3} height={gap} fill={gapColor} />
              <line x1={step*5} y1={0} x2={step*5} y2={boardWidth} stroke={gapColor} strokeWidth={gap} opacity={0.7} />
            </pattern>
            
            {/* Herringbone (Chevron) Pattern */}
            <pattern id="pattern-herringbone" width={step * 4} height={step * 4} patternUnits="userSpaceOnUse">
              <rect width={step*4} height={step*4} fill={gapColor} />
              
              <g>
                <path d={`M 0 ${step} L ${step*2} ${step*3} L ${step*4} ${step}`} stroke={boardColor} strokeWidth={boardWidth} fill="none" strokeLinecap="square" filter="url(#wood-grain)" />
                <path d={`M 0 ${step} L ${step*2} ${step*3} L ${step*4} ${step}`} stroke="url(#bevel-v)" strokeWidth={boardWidth} fill="none" strokeLinecap="square" opacity="0.6" />
              </g>
              <g>
                <path d={`M 0 ${step*3} L ${step*2} ${step*5} L ${step*4} ${step*3}`} stroke={boardColor} strokeWidth={boardWidth} fill="none" strokeLinecap="square" filter="url(#wood-grain)" />
                <path d={`M 0 ${step*3} L ${step*2} ${step*5} L ${step*4} ${step*3}`} stroke="url(#bevel-v)" strokeWidth={boardWidth} fill="none" strokeLinecap="square" opacity="0.6" />
              </g>
              <g>
                <path d={`M 0 ${-step} L ${step*2} ${step} L ${step*4} ${-step}`} stroke={boardColor} strokeWidth={boardWidth} fill="none" strokeLinecap="square" filter="url(#wood-grain)" />
                <path d={`M 0 ${-step} L ${step*2} ${step} L ${step*4} ${-step}`} stroke="url(#bevel-v)" strokeWidth={boardWidth} fill="none" strokeLinecap="square" opacity="0.6" />
              </g>
            </pattern>

            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 2 L 10 5 L 0 8 z" fill="#475569" />
            </marker>
          </defs>
          
          <g transform={`translate(${margin}, ${margin})`}>
            {/* Deck Base/Shadow */}
            <rect x={0} y={0} width={viewBoxWidth} height={viewBoxHeight} fill={gapColor} rx={4} />
            
            {/* Main Field */}
            <rect 
              x={pfThickness} 
              y={pfThickness} 
              width={Math.max(0, viewBoxWidth - pfThickness * 2)} 
              height={Math.max(0, viewBoxHeight - pfThickness * 2)} 
              fill={`url(#${getPatternId()})`} 
            />
            
            {/* Breaker Boards */}
            {needsBreaker && breakerPositions.map((pos, i) => {
              if (isWidthBreaker) {
                // Vertical breaker splitting the width
                const startX = pos - breakerThickness / 2;
                const startY = pfThickness;
                const bHeight = Math.max(0, viewBoxHeight - pfThickness * 2);
                
                return (
                  <g key={`breaker-${i}`}>
                    {/* Background gap for the breaker area */}
                    <rect x={startX - gap} y={startY} width={breakerThickness + gap * 2} height={bHeight} fill={gapColor} />
                    
                    {Array.from({ length: boardsPerBreaker }).map((_, bIdx) => {
                      const bx = startX + bIdx * step;
                      return (
                        <g key={`b-${bIdx}`}>
                          <rect x={bx} y={startY} width={boardWidth} height={bHeight} fill={boardColor} filter="url(#wood-grain)" />
                          <rect x={bx} y={startY} width={boardWidth} height={bHeight} fill="url(#bevel-h)" />
                        </g>
                      );
                    })}
                  </g>
                );
              } else {
                // Horizontal breaker splitting the depth
                const startX = pfThickness;
                const startY = pos - breakerThickness / 2;
                const bWidth = Math.max(0, viewBoxWidth - pfThickness * 2);
                
                return (
                  <g key={`breaker-${i}`}>
                    {/* Background gap for the breaker area */}
                    <rect x={startX} y={startY - gap} width={bWidth} height={breakerThickness + gap * 2} fill={gapColor} />
                    
                    {Array.from({ length: boardsPerBreaker }).map((_, bIdx) => {
                      const by = startY + bIdx * step;
                      return (
                        <g key={`b-${bIdx}`}>
                          <rect x={startX} y={by} width={bWidth} height={boardWidth} fill={boardColor} filter="url(#wood-grain)" />
                          <rect x={startX} y={by} width={bWidth} height={boardWidth} fill="url(#bevel-v)" />
                        </g>
                      );
                    })}
                  </g>
                );
              }
            })}
            
            {/* Picture Frames */}
            {Array.from({ length: pfBoards }).map((_, i) => {
              const offset = i * step;
              const w = viewBoxWidth - i * 2 * step;
              const h = viewBoxHeight - i * 2 * step;
              if (w <= 0 || h <= 0) return null;
              
              return (
                <g key={`pf-${i}`}>
                  {/* Top */}
                  <polygon points={`${offset},${offset} ${offset + w},${offset} ${offset + w - boardWidth},${offset + boardWidth} ${offset + boardWidth},${offset + boardWidth}`} fill={boardColor} filter="url(#wood-grain)" />
                  <polygon points={`${offset},${offset} ${offset + w},${offset} ${offset + w - boardWidth},${offset + boardWidth} ${offset + boardWidth},${offset + boardWidth}`} fill="url(#bevel-v)" />
                  
                  {/* Right */}
                  <polygon points={`${offset + w},${offset} ${offset + w},${offset + h} ${offset + w - boardWidth},${offset + h - boardWidth} ${offset + w - boardWidth},${offset + boardWidth}`} fill={boardColor} filter="url(#wood-grain)" />
                  <polygon points={`${offset + w},${offset} ${offset + w},${offset + h} ${offset + w - boardWidth},${offset + h - boardWidth} ${offset + w - boardWidth},${offset + boardWidth}`} fill="url(#bevel-h)" />
                  
                  {/* Bottom */}
                  <polygon points={`${offset},${offset + h} ${offset + w},${offset + h} ${offset + w - boardWidth},${offset + h - boardWidth} ${offset + boardWidth},${offset + h - boardWidth}`} fill={boardColor} filter="url(#wood-grain)" />
                  <polygon points={`${offset},${offset + h} ${offset + w},${offset + h} ${offset + w - boardWidth},${offset + h - boardWidth} ${offset + boardWidth},${offset + h - boardWidth}`} fill="url(#bevel-v)" />
                  
                  {/* Left */}
                  <polygon points={`${offset},${offset} ${offset},${offset + h} ${offset + boardWidth},${offset + h - boardWidth} ${offset + boardWidth},${offset + boardWidth}`} fill={boardColor} filter="url(#wood-grain)" />
                  <polygon points={`${offset},${offset} ${offset},${offset + h} ${offset + boardWidth},${offset + h - boardWidth} ${offset + boardWidth},${offset + boardWidth}`} fill="url(#bevel-h)" />
                  
                  {/* Miter Seams (Subtle lines at the corners) */}
                  <line x1={offset} y1={offset} x2={offset + boardWidth} y2={offset + boardWidth} stroke={gapColor} strokeWidth={gap/2} opacity={0.5} />
                  <line x1={offset + w} y1={offset} x2={offset + w - boardWidth} y2={offset + boardWidth} stroke={gapColor} strokeWidth={gap/2} opacity={0.5} />
                  <line x1={offset + w} y1={offset + h} x2={offset + w - boardWidth} y2={offset + h - boardWidth} stroke={gapColor} strokeWidth={gap/2} opacity={0.5} />
                  <line x1={offset} y1={offset + h} x2={offset + boardWidth} y2={offset + h - boardWidth} stroke={gapColor} strokeWidth={gap/2} opacity={0.5} />
                </g>
              );
            })}

            {/* Stairs */}
            {hasStairs && (
              <g className="stairs">
                <rect 
                  x={stairX} 
                  y={stairY} 
                  width={stairW_svg} 
                  height={stairH_svg} 
                  fill={boardColor} 
                  filter="url(#wood-grain)" 
                  stroke={gapColor}
                  strokeWidth={gap}
                />
                {/* Stair Treads (Lines) */}
                {data.stairPosition === 'Front' || data.stairPosition === 'Back' ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <line 
                      key={`tread-${i}`}
                      x1={stairX} 
                      y1={stairY + (i + 1) * (stairH_svg / 5)} 
                      x2={stairX + stairW_svg} 
                      y2={stairY + (i + 1) * (stairH_svg / 5)} 
                      stroke={gapColor} 
                      strokeWidth={gap} 
                    />
                  ))
                ) : (
                  Array.from({ length: 4 }).map((_, i) => (
                    <line 
                      key={`tread-${i}`}
                      x1={stairX + (i + 1) * (stairW_svg / 5)} 
                      y1={stairY} 
                      x2={stairX + (i + 1) * (stairW_svg / 5)} 
                      y2={stairY + stairH_svg} 
                      stroke={gapColor} 
                      strokeWidth={gap} 
                    />
                  ))
                )}
              </g>
            )}

            {/* Railing */}
            {hasRailing && (
              <g className="railing">
                {/* Top Railing */}
                {!(hasStairs && data.stairPosition === 'Back') && (
                  <line x1={railingInset} y1={railingInset} x2={viewBoxWidth - railingInset} y2={railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />
                )}
                {hasStairs && data.stairPosition === 'Back' && (
                  <>
                    {stairX > railingInset && <line x1={railingInset} y1={railingInset} x2={stairX} y2={railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                    {stairX + stairW < viewBoxWidth - railingInset && <line x1={stairX + stairW} y1={railingInset} x2={viewBoxWidth - railingInset} y2={railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                  </>
                )}

                {/* Bottom Railing */}
                {!(hasStairs && data.stairPosition === 'Front') && (
                  <line x1={railingInset} y1={viewBoxHeight - railingInset} x2={viewBoxWidth - railingInset} y2={viewBoxHeight - railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />
                )}
                {hasStairs && data.stairPosition === 'Front' && (
                  <>
                    {stairX > railingInset && <line x1={railingInset} y1={viewBoxHeight - railingInset} x2={stairX} y2={viewBoxHeight - railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                    {stairX + stairW < viewBoxWidth - railingInset && <line x1={stairX + stairW} y1={viewBoxHeight - railingInset} x2={viewBoxWidth - railingInset} y2={viewBoxHeight - railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                  </>
                )}

                {/* Left Railing */}
                {!(hasStairs && data.stairPosition === 'Left') && (
                  <line x1={railingInset} y1={railingInset} x2={railingInset} y2={viewBoxHeight - railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />
                )}
                {hasStairs && data.stairPosition === 'Left' && (
                  <>
                    {stairY > railingInset && <line x1={railingInset} y1={railingInset} x2={railingInset} y2={stairY} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                    {stairY + stairW < viewBoxHeight - railingInset && <line x1={railingInset} y1={stairY + stairW} x2={railingInset} y2={viewBoxHeight - railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                  </>
                )}

                {/* Right Railing */}
                {!(hasStairs && data.stairPosition === 'Right') && (
                  <line x1={viewBoxWidth - railingInset} y1={railingInset} x2={viewBoxWidth - railingInset} y2={viewBoxHeight - railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />
                )}
                {hasStairs && data.stairPosition === 'Right' && (
                  <>
                    {stairY > railingInset && <line x1={viewBoxWidth - railingInset} y1={railingInset} x2={viewBoxWidth - railingInset} y2={stairY} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                    {stairY + stairW < viewBoxHeight - railingInset && <line x1={viewBoxWidth - railingInset} y1={stairY + stairW} x2={viewBoxWidth - railingInset} y2={viewBoxHeight - railingInset} stroke={railingColor} strokeWidth={railingThickness} strokeLinecap="round" />}
                  </>
                )}
              </g>
            )}
          </g>
          
          {/* Dimensions */}
          <g className="font-sans font-medium" fill="#475569">
            {/* Width Dimension */}
            <line x1={margin} y1={margin * 0.6} x2={margin + viewBoxWidth} y2={margin * 0.6} stroke="#475569" strokeWidth={strokeW} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <text x={margin + viewBoxWidth / 2} y={margin * 0.4} textAnchor="middle" fontSize={fontSize}>{widthFt}' Width</text>
            
            {/* Depth Dimension */}
            <line x1={margin * 0.6} y1={margin} x2={margin * 0.6} y2={margin + viewBoxHeight} stroke="#475569" strokeWidth={strokeW} markerEnd="url(#arrow)" markerStart="url(#arrow)" />
            <text x={margin * 0.4} y={margin + viewBoxHeight / 2} textAnchor="middle" transform={`rotate(-90, ${margin * 0.4}, ${margin + viewBoxHeight / 2})`} fontSize={fontSize}>{depthFt}' Depth</text>
          </g>
        </svg>
      </div>
      
      <div className="p-4 bg-brand-surface border-t border-white/5 text-xs text-brand-muted flex justify-between items-center">
        <span>* Diagram is a top-down representation of the bounding area.</span>
        {needsBreaker && <span className="text-brand-gold font-medium">Includes {breaker_rows} required breaker row(s)</span>}
      </div>
    </div>
  );
};

