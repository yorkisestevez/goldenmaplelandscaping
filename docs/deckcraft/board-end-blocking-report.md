# DeckCraft board-end blocking: before/after report

Status: **awaiting owner approval.** The change is on branch `fix/deckcraft-end-face-blocking` and has not been merged or pushed. The legacy parity golden (`scripts/deck-legacy-golden.json`) has **not** been regenerated.

## What changes

Every board end gets a block between the joists under it (`addConstructionDetails` in `src/features/deckcraft/constructionDetails.ts`). The block was placed where the board's centreline ends. For a board cut square, that point is on the end face. For a board cut at 45° (a Diagonal or Herringbone field board meeting a border row), the centreline ends about 1.9 in past the cut face, inside the border row. The blocks then land under the border boards, sometimes in the next joist bay, and nothing sits under the field board's actual end.

The fix moves the block to the middle of the actual end face, but only when both of these are true:

- the centreline's end is more than 0.5 in off the end face, so square and nearly square ends keep exactly the blocks they had;
- the end face stands clear of the rim, more than 1.5 in inside the outline. An end that reaches the rim (a cut along the outline, a border mitre at a corner, or a mitre between curved-border pieces) keeps its old backing.

On angled-corner levels, the `feat/deckcraft-v2` work already uses the same end-face midpoint (`endFaces`). This branch applies it to every regular level on `main`. Wrap-around levels have their own blocking code, which this branch does not change: Diagonal and Herringbone are not allowed on a wrap, and field ends at a hip bear on the doubled hip.

## Headline numbers

- **Legacy parity golden:** 13 of 213 scenarios change. The other 200 are identical in every fingerprinted part (model, issues, flags, hardware, extras, catalogue, exports, estimate). No issue or flag text changes in any golden scenario.
- **Price changes in the golden:** 8 of 213 scenarios, from −$2.14 to +$109.83. The other 5 changed scenarios move blocks, blocking connections (unpriced, supplier quote) and the drawn model, but keep the same total.
- **Designs the golden does not cover are the ones that change most.** The golden has no Diagonal or Herringbone design with border rows. Across 64 such designs (16×12, 24×18, 12×10 and 20×14; every shape; 1 or 2 border rows), **all 64 change price**: from −$680.37 to +$308.94, average −$7.24.
- **Board ends with nothing under them:** 848 → 78 across all 405 designs measured. For Diagonal/Herringbone with borders: 736 → 32. (The 78 left are a separate issue, see "Not fixed here".)

## Why prices move

- **Screws.** The model counts a deck screw wherever a board crosses a joist or block. The old blocks ran under the border boards, parallel to them, so they added few screws. The moved blocks sit under the field boards' ends and get fastened, at $0.28 per screw plus the 10% allowance.
- **Framing stock.** Blocks are cut from 16 ft 2×10 stock. When the cut plan needs one more or one fewer 16 ft piece, the framing line moves by about $97 with markup (for example $3,304.80 → $3,207.60 for one 16 ft piece fewer).
- **Fewer blocks along the front and back borders.** The old, misplaced ends along a border's inner edge landed at slightly different depths inside the border, so each joist bay collected several overlapping block pairs a fraction of an inch apart. On a 24×18 two-row Herringbone deck, for example, back-border blocks go from 142 to 91 and front-border blocks from 144 to 100. The moved ends all lie on the border's inner edge, share one depth and collapse to one pair per bay. That is why two-row Herringbone designs mostly get cheaper.
- Labour (man-hours) does not change in any of the 405 designs measured.

## A. Legacy parity scenarios that change

13 of 213. Every other golden scenario is unchanged.

| Scenario | Board-end blocks | Framing pieces (16 ft) | Blocking connections | Deck screws | Total before | Total after | Change |
|---|---|---|---|---|---|---|---|
| `std/Curved/Picture Frame/Straight/attached` | 54 → 56 | 25 | 138 → 142 | 1094 | $44,162.29 | $44,162.29 | none |
| `std/Curved/Picture Frame/Straight/freestanding-2lvl` | 74 → 78 | 52 | 204 → 212 | 1785 | $98,815.03 | $98,815.03 | none |
| `std/Curved/Picture Frame/Landing/attached` | 54 → 56 | 30 | 138 → 142 | 1252 | $53,158.57 | $53,158.57 | none |
| `std/Curved/Picture Frame/Landing/freestanding-2lvl` | 74 → 78 | 52 | 204 → 212 | 1785 | $99,767.51 | $99,767.51 | none |
| `std/Curved/Picture Frame/Winder/attached` | 54 → 56 | 29 → 30 | 138 → 142 | 1094 | $56,461.73 | $56,571.56 | +$109.83 |
| `std/Curved/Picture Frame/Winder/freestanding-2lvl` | 74 → 78 | 52 | 204 → 212 | 1785 | $100,402.50 | $100,402.50 | none |
| `big/Curved/Picture Frame/Straight/attached` | 43 → 49 | 79 | 192 → 204 | 2876 → 2885 | $112,244.95 | $112,248.79 | +$3.84 |
| `big/Curved/Picture Frame/Straight/freestanding-2lvl` | 62 → 64 | 109 | 256 → 260 | 3582 → 3578 | $197,447.29 | $197,445.58 | −$1.71 |
| `big/Curved/Picture Frame/Landing/attached` | 43 → 49 | 80 | 192 → 204 | 3056 → 3065 | $121,550.81 | $121,554.66 | +$3.85 |
| `big/Curved/Picture Frame/Landing/freestanding-2lvl` | 62 → 64 | 111 | 256 → 260 | 3741 → 3736 | $209,242.16 | $209,240.02 | −$2.14 |
| `big/Curved/Picture Frame/Winder/attached` | 43 → 49 | 79 | 192 → 204 | 2876 → 2885 | $125,968.92 | $125,972.76 | +$3.84 |
| `big/Curved/Picture Frame/Winder/freestanding-2lvl` | 62 → 64 | 109 | 256 → 260 | 3582 → 3578 | $214,690.51 | $214,688.80 | −$1.71 |
| `border/2-matching-lshape` | 110 | 27 | 236 | 819 → 821 | $29,867.66 | $29,868.52 | +$0.86 |

What these are:

- **Curved + Picture Frame (12 scenarios).** Straight field boards meet the curved border's inner edge at a slant, so their centreline ends past the cut. With the fix, the ends the old placement left with nothing under them get backed: 2 in each std attached design, 6 in each big attached design. The freestanding two-level variants had none unbacked, but their blocks move onto the actual faces too.
- **`border/2-matching-lshape`.** The second border row's mitre at the L's inside corner stands about 4.8 in clear of the rim. Its two block pairs move from in front of the mitre (under the neighbouring board) to under the mitre itself. The block count is the same; 2 more screws.

## B. Diagonal and Herringbone with border rows (not in the golden)

| Pattern | Borders | Designs | Changed | Board-end blocks | Unbacked ends | Lowest change | Highest change | Average |
|---|---|---|---|---|---|---|---|---|
| Diagonal | 1 | 16 | 16 | 3053 → 3099 | 227 → 0 | +$26.06 | +$308.94 | +$112.18 |
| Diagonal | 2 | 16 | 16 | 4061 → 3898 | 241 → 21 | −$71.39 | +$78.17 | +$5.58 |
| Herringbone | 1 | 16 | 16 | 8609 → 8395 | 198 → 0 | −$413.23 | +$305.10 | +$78.00 |
| Herringbone | 2 | 16 | 16 | 9221 → 8455 | 70 → 11 | −$680.37 | +$54.68 | −$224.71 |

Every design:

| Design | Board-end blocks | Framing pieces | Deck screws | Unbacked ends | Total before | Total after | Change |
|---|---|---|---|---|---|---|---|
| 16x12/Rectangle/Diagonal/rows1 | 164 → 154 | 32 | 1298 → 1384 | 9 → 0 | $32,672.25 | $32,708.98 | +$36.73 |
| 16x12/Rectangle/Diagonal/rows2 | 200 → 192 | 33 → 32 | 1292 → 1404 | 14 → 0 | $32,779.52 | $32,717.52 | −$62.00 |
| 16x12/Rectangle/Herringbone/rows1 | 388 → 372 | 43 | 1930 → 1998 | 10 → 0 | $35,691.65 | $35,720.69 | +$29.04 |
| 16x12/Rectangle/Herringbone/rows2 | 426 → 412 | 44 | 1943 → 2071 | 8 → 0 | $35,807.03 | $35,861.71 | +$54.68 |
| 16x12/L-Shape/Diagonal/rows1 | 136 → 150 | 30 → 31 | 1054 → 1199 | 15 → 0 | $33,390.21 | $33,561.98 | +$171.77 |
| 16x12/L-Shape/Diagonal/rows2 | 192 → 186 | 32 | 1164 → 1274 | 14 → 0 | $33,656.87 | $33,703.85 | +$46.98 |
| 16x12/L-Shape/Herringbone/rows1 | 304 | 38 → 39 | 1510 → 1626 | 13 → 0 | $35,982.54 | $36,141.93 | +$159.39 |
| 16x12/L-Shape/Herringbone/rows2 | 340 → 326 | 40 → 39 | 1571 → 1684 | 6 → 0 | $36,228.27 | $36,166.70 | −$61.57 |
| 16x12/Multi-corner/Diagonal/rows1 | 110 → 138 | 24 → 26 | 854 → 1041 | 21 → 0 | $34,741.41 | $35,040.95 | +$299.54 |
| 16x12/Multi-corner/Diagonal/rows2 | 170 → 168 | 27 → 26 | 1050 → 1160 | 14 → 0 | $35,154.63 | $35,091.78 | −$62.85 |
| 16x12/Multi-corner/Herringbone/rows1 | 266 → 280 | 32 → 33 | 1270 → 1428 | 16 → 0 | $37,485.57 | $37,662.89 | +$177.32 |
| 16x12/Multi-corner/Herringbone/rows2 | 303 → 278 | 33 → 32 | 1396 → 1461 | 4 → 0 | $37,649.23 | $37,567.15 | −$82.08 |
| 16x12/Curved/Diagonal/rows1 | 168 | 33 → 34 | 1356 → 1431 | 10 → 0 | $44,176.42 | $44,318.29 | +$141.87 |
| 16x12/Curved/Diagonal/rows2 | 255 → 254 | 37 | 1461 → 1580 | 11 → 0 | $44,660.61 | $44,711.44 | +$50.83 |
| 16x12/Curved/Herringbone/rows1 | 480 → 470 | 49 | 2258 → 2304 | 11 → 0 | $48,583.22 | $48,602.86 | +$19.64 |
| 16x12/Curved/Herringbone/rows2 | 530 → 480 | 51 → 49 | 2247 → 2273 | 6 → 0 | $48,798.19 | $48,589.62 | −$208.57 |
| 24x18/Rectangle/Diagonal/rows1 | 318 → 302 | 74 | 2720 → 2832 | 16 → 0 | $55,441.15 | $55,488.99 | +$47.84 |
| 24x18/Rectangle/Diagonal/rows2 | 392 → 378 | 76 → 75 | 2693 → 2872 | 19 → 0 | $55,649.29 | $55,615.91 | −$33.38 |
| 24x18/Rectangle/Herringbone/rows1 | 978 → 942 | 108 | 4499 → 4603 | 17 → 0 | $62,388.82 | $62,433.25 | +$44.43 |
| 24x18/Rectangle/Herringbone/rows2 | 1022 → 914 | 110 → 104 | 4427 → 4387 | 0 | $62,678.43 | $62,002.32 | −$676.11 |
| 24x18/L-Shape/Diagonal/rows1 | 284 → 286 | 62 | 2445 → 2616 | 22 → 0 | $56,198.63 | $56,271.67 | +$73.04 |
| 24x18/L-Shape/Diagonal/rows2 | 370 → 360 | 65 → 64 | 2552 → 2744 | 20 → 0 | $56,573.85 | $56,546.02 | −$27.83 |
| 24x18/L-Shape/Herringbone/rows1 | 882 → 866 | 92 → 93 | 4068 → 4229 | 15 → 0 | $62,935.84 | $63,114.44 | +$178.60 |
| 24x18/L-Shape/Herringbone/rows2 | 936 → 828 | 95 → 89 | 4090 → 4040 | 0 | $63,274.74 | $62,594.37 | −$680.37 |
| 24x18/Multi-corner/Diagonal/rows1 | 288 → 304 | 59 → 61 | 2363 → 2572 | 27 → 0 | $58,978.00 | $59,286.94 | +$308.94 |
| 24x18/Multi-corner/Diagonal/rows2 | 378 → 370 | 63 | 2541 → 2724 | 22 → 0 | $59,493.37 | $59,571.54 | +$78.17 |
| 24x18/Multi-corner/Herringbone/rows1 | 812 → 813 | 86 → 88 | 3807 → 4007 | 18 → 0 | $65,463.81 | $65,768.91 | +$305.10 |
| 24x18/Multi-corner/Herringbone/rows2 | 876 → 776 | 90 → 85 | 3895 → 3862 | 2 → 0 | $65,940.74 | $65,377.46 | −$563.28 |
| 24x18/Curved/Diagonal/rows1 | 337 → 329 | 82 | 3094 → 3155 | 12 → 0 | $81,071.18 | $81,097.24 | +$26.06 |
| 24x18/Curved/Diagonal/rows2 | 450 → 396 | 82 | 3030 → 3149 | 29 → 21 | $81,043.85 | $81,094.68 | +$50.83 |
| 24x18/Curved/Herringbone/rows1 | 1124 → 1034 | 113 → 110 | 5014 → 4818 | 4 → 0 | $89,427.73 | $89,014.50 | −$413.23 |
| 24x18/Curved/Herringbone/rows2 | 1094 → 1036 | 111 → 110 | 4713 → 4810 | 23 → 11 | $89,079.49 | $89,011.08 | −$68.41 |
| 12x10/Rectangle/Diagonal/rows1 | 108 → 100 | 25 | 909 → 973 | 6 → 0 | $26,040.25 | $26,067.59 | +$27.34 |
| 12x10/Rectangle/Diagonal/rows2 | 140 → 134 | 25 | 872 → 962 | 10 → 0 | $26,024.45 | $26,062.89 | +$38.44 |
| 12x10/Rectangle/Herringbone/rows1 | 278 → 266 | 33 | 1408 → 1455 | 8 → 0 | $28,292.56 | $28,312.63 | +$20.07 |
| 12x10/Rectangle/Herringbone/rows2 | 318 → 284 | 34 → 33 | 1362 → 1420 | 0 | $28,382.74 | $28,297.68 | −$85.06 |
| 12x10/L-Shape/Diagonal/rows1 | 90 → 94 | 18 | 632 → 731 | 10 → 0 | $26,371.84 | $26,414.12 | +$42.28 |
| 12x10/L-Shape/Diagonal/rows2 | 116 → 108 | 19 → 18 | 663 → 753 | 9 → 0 | $26,494.91 | $26,423.52 | −$71.39 |
| 12x10/L-Shape/Herringbone/rows1 | 200 → 202 | 23 → 24 | 940 → 1037 | 9 → 0 | $28,298.72 | $28,449.99 | +$151.27 |
| 12x10/L-Shape/Herringbone/rows2 | 234 → 200 | 25 → 23 | 986 → 1017 | 0 | $28,538.04 | $28,331.61 | −$206.43 |
| 12x10/Multi-corner/Diagonal/rows1 | 88 → 112 | 16 → 17 | 544 → 669 | 13 → 0 | $28,341.21 | $28,504.44 | +$163.23 |
| 12x10/Multi-corner/Diagonal/rows2 | 90 → 76 | 16 | 559 → 608 | 6 → 0 | $28,347.62 | $28,368.55 | +$20.93 |
| 12x10/Multi-corner/Herringbone/rows1 | 171 → 188 | 20 → 21 | 753 → 854 | 9 → 0 | $30,277.88 | $30,430.86 | +$152.98 |
| 12x10/Multi-corner/Herringbone/rows2 | 172 → 144 | 20 → 19 | 768 → 784 | 0 | $30,284.29 | $30,181.29 | −$103.00 |
| 12x10/Curved/Diagonal/rows1 | 122 → 126 | 25 → 26 | 966 → 1026 | 5 → 0 | $35,421.40 | $35,556.87 | +$135.47 |
| 12x10/Curved/Diagonal/rows2 | 202 → 194 | 28 | 1013 → 1094 | 8 → 0 | $35,770.99 | $35,805.59 | +$34.60 |
| 12x10/Curved/Herringbone/rows1 | 302 → 290 | 34 | 1486 → 1516 | 7 → 0 | $38,356.47 | $38,369.28 | +$12.81 |
| 12x10/Curved/Herringbone/rows2 | 368 → 346 | 37 → 36 | 1519 → 1571 | 8 → 0 | $38,700.07 | $38,612.44 | −$87.63 |
| 20x14/Rectangle/Diagonal/rows1 | 214 → 202 | 45 | 1780 → 1886 | 12 → 0 | $40,765.85 | $40,811.12 | +$45.27 |
| 20x14/Rectangle/Diagonal/rows2 | 272 → 262 | 47 → 46 | 1769 → 1912 | 18 → 0 | $40,980.82 | $40,932.06 | −$48.76 |
| 20x14/Rectangle/Herringbone/rows1 | 654 → 626 | 67 | 2979 → 3065 | 13 → 0 | $45,611.84 | $45,648.57 | +$36.73 |
| 20x14/Rectangle/Herringbone/rows2 | 686 → 632 | 69 → 66 | 2918 → 3037 | 0 | $45,805.46 | $45,526.78 | −$278.68 |
| 20x14/L-Shape/Diagonal/rows1 | 200 → 198 | 42 | 1554 → 1686 | 17 → 0 | $41,242.44 | $41,298.82 | +$56.38 |
| 20x14/L-Shape/Diagonal/rows2 | 248 → 242 | 43 | 1598 → 1750 | 18 → 0 | $41,371.07 | $41,435.99 | +$64.92 |
| 20x14/L-Shape/Herringbone/rows1 | 566 → 558 | 60 | 2548 → 2680 | 19 → 0 | $45,566.70 | $45,623.08 | +$56.38 |
| 20x14/L-Shape/Herringbone/rows2 | 601 → 544 | 62 → 59 | 2588 → 2660 | 0 | $45,803.45 | $45,504.70 | −$298.75 |
| 20x14/Multi-corner/Diagonal/rows1 | 182 → 198 | 37 → 38 | 1413 → 1593 | 24 → 0 | $43,795.53 | $43,982.25 | +$186.72 |
| 20x14/Multi-corner/Diagonal/rows2 | 234 → 228 | 39 → 38 | 1525 → 1664 | 18 → 0 | $44,063.04 | $44,012.57 | −$50.47 |
| 20x14/Multi-corner/Herringbone/rows1 | 494 → 504 | 52 → 53 | 2262 → 2440 | 20 → 0 | $47,978.79 | $48,164.65 | +$185.86 |
| 20x14/Multi-corner/Herringbone/rows2 | 541 → 494 | 55 → 53 | 2383 → 2451 | 2 → 0 | $48,359.98 | $48,169.35 | −$190.63 |
| 20x14/Curved/Diagonal/rows1 | 244 → 238 | 48 | 2014 → 2090 | 8 → 0 | $56,426.86 | $56,459.32 | +$32.46 |
| 20x14/Curved/Diagonal/rows2 | 352 → 350 | 52 | 2077 → 2218 | 11 → 0 | $56,893.11 | $56,953.34 | +$60.23 |
| 20x14/Curved/Herringbone/rows1 | 710 → 680 | 70 → 71 | 3133 → 3184 | 9 → 0 | $62,218.44 | $62,350.06 | +$131.62 |
| 20x14/Curved/Herringbone/rows2 | 774 → 761 | 74 → 73 | 3136 → 3254 | 11 → 0 | $62,659.07 | $62,599.63 | −$59.44 |

## C. Other designs outside the golden that change

Straight and Picture Frame designs with 1 or 2 border rows, same sizes and shapes: 34 of 128 change. Each is a curved-border slant cut or the inside-corner mitre of a second border row, as in A.

| Design | Board-end blocks | Unbacked ends | Total before | Total after | Change |
|---|---|---|---|---|---|
| 16x12/L-Shape/Straight/rows2 | 110 | 0 | $29,867.66 | $29,868.52 | +$0.86 |
| 16x12/L-Shape/Picture Frame/rows2 | 110 | 0 | $33,614.50 | $33,615.35 | +$0.85 |
| 16x12/Multi-corner/Straight/rows2 | 120 | 1 → 0 | $31,204.56 | $31,206.27 | +$1.71 |
| 16x12/Multi-corner/Picture Frame/rows2 | 120 | 1 → 0 | $35,474.36 | $35,476.07 | +$1.71 |
| 16x12/Curved/Straight/rows1 | 54 → 56 | 2 → 0 | $38,703.30 | $38,703.30 | none |
| 16x12/Curved/Straight/rows2 | 196 | 2 → 0 | $39,603.34 | $39,599.92 | −$3.42 |
| 16x12/Curved/Picture Frame/rows0 | 54 → 56 | 2 → 0 | $44,162.29 | $44,162.29 | none |
| 16x12/Curved/Picture Frame/rows1 | 54 → 56 | 2 → 0 | $44,162.29 | $44,162.29 | none |
| 16x12/Curved/Picture Frame/rows2 | 196 | 2 → 0 | $45,062.33 | $45,058.92 | −$3.41 |
| 24x18/Rectangle/Straight/rows2 | 155 → 153 | 0 | $52,205.51 | $52,203.37 | −$2.14 |
| 24x18/Rectangle/Picture Frame/rows2 | 155 → 153 | 0 | $57,936.58 | $57,934.44 | −$2.14 |
| 24x18/L-Shape/Straight/rows2 | 162 → 160 | 0 | $52,531.70 | $52,529.99 | −$1.71 |
| 24x18/L-Shape/Picture Frame/rows2 | 162 → 160 | 0 | $58,785.10 | $58,783.40 | −$1.70 |
| 24x18/Multi-corner/Straight/rows2 | 172 → 170 | 0 | $54,520.21 | $54,517.22 | −$2.99 |
| 24x18/Multi-corner/Picture Frame/rows2 | 172 → 170 | 0 | $61,464.67 | $61,461.68 | −$2.99 |
| 24x18/Curved/Straight/rows1 | 45 | 2 → 0 | $76,014.05 | $76,014.05 | none |
| 24x18/Curved/Picture Frame/rows0 | 45 | 2 → 0 | $85,944.55 | $85,944.55 | none |
| 24x18/Curved/Picture Frame/rows1 | 45 | 2 → 0 | $85,944.55 | $85,944.55 | none |
| 12x10/L-Shape/Straight/rows2 | 86 | 0 | $23,792.23 | $23,791.38 | −$0.85 |
| 12x10/L-Shape/Picture Frame/rows2 | 86 | 0 | $26,857.25 | $26,856.39 | −$0.86 |
| 12x10/Multi-corner/Straight/rows2 | 40 → 44 | 0 | $25,195.73 | $25,200.42 | +$4.69 |
| 12x10/Multi-corner/Picture Frame/rows2 | 40 → 44 | 0 | $28,564.83 | $28,569.53 | +$4.70 |
| 12x10/Curved/Straight/rows1 | 52 → 58 | 2 → 0 | $31,699.25 | $31,700.10 | +$0.85 |
| 12x10/Curved/Straight/rows2 | 170 → 166 | 2 → 0 | $32,478.59 | $32,473.90 | −$4.69 |
| 12x10/Curved/Picture Frame/rows0 | 52 → 58 | 2 → 0 | $35,758.60 | $35,759.45 | +$0.85 |
| 12x10/Curved/Picture Frame/rows1 | 52 → 58 | 2 → 0 | $35,758.60 | $35,759.45 | +$0.85 |
| 12x10/Curved/Picture Frame/rows2 | 170 → 166 | 2 → 0 | $36,537.95 | $36,533.25 | −$4.70 |
| 20x14/L-Shape/Straight/rows2 | 122 | 0 | $39,604.25 | $39,605.10 | +$0.85 |
| 20x14/L-Shape/Picture Frame/rows2 | 122 | 0 | $44,209.23 | $44,210.09 | +$0.86 |
| 20x14/Multi-corner/Straight/rows2 | 132 | 0 | $41,656.92 | $41,657.78 | +$0.86 |
| 20x14/Multi-corner/Picture Frame/rows2 | 132 | 0 | $46,929.18 | $46,930.04 | +$0.86 |
| 20x14/Curved/Straight/rows1 | 42 → 44 | 2 → 0 | $57,758.14 | $57,760.27 | +$2.13 |
| 20x14/Curved/Picture Frame/rows0 | 42 → 44 | 2 → 0 | $65,322.41 | $65,324.54 | +$2.13 |
| 20x14/Curved/Picture Frame/rows1 | 42 → 44 | 2 → 0 | $65,322.41 | $65,324.54 | +$2.13 |

## How "nothing under the end" is measured

Nine points are placed 0.4 in inside each board's actual end face, spread from 5% to 95% along it. An end counts as backed when a joist, block, rim or hip centreline passes within 0.85 in of at least one point (half a 1.5 in member plus 0.1 in). This differs from the original three-point probe (1,508 ends), so the counts are not directly comparable. Three points miss correctly placed doubled blocks, which sit ±0.94 in either side of the board's middle. The same nine-point test is now a permanent assertion in `scripts/check-deck-borders.ts`: it fails on `main` (first failure: `Rectangle/Diagonal/1`, a board end at 184.54, 5.69) and passes on this branch (9,344 board ends).

## Not fixed here (follow-ups)

- **Marginal bearing on a joist.** `blockBoardEnd` treats an end as "on a joist" when a joist centre is within 0.76 in of the end point, whichever side it is on. When the joist is past the end face, the board bears on it by about 0.3 in. This covers the 78 ends still counted as unbacked: 46 in `border/1-dark-slate`, where the 0.5 in border overhang puts the field edge 0.56 in past the 3.875 in build-up joist, and 32 in the 24×18 Curved two-row designs. The same case accounts for 4 ends in two-row wrap-around designs, which this branch does not touch. It is square-end logic, and changing it would reprice many designs, so it needs its own approval.
- **Overlapping blocks are double-counted.** Blocks are de-duplicated only by exact position, so blocks a fraction of an inch apart are both built and priced. On `main`, a borderless 16×12 Herringbone deck has 396 board-end blocks, with 221 pairs overlapping (under 1.5 in apart in the same bay); a 16×12 Diagonal deck has 100 blocks and 50 overlapping pairs. The fix reduces this only where it moves ends. Merging overlaps would lower the price of existing Diagonal and Herringbone designs, so it needs its own approval.
- **Build-up joists for two border rows.** The side build-up joists sit at 3.875 in and 6.25 in whatever the border row count and overhang. With two rows, the second row's inner edge is not over a build-up joist.
- **Merging with `feat/deckcraft-v2`.** The angled-corner branch in the v2 checkout (not yet committed) changes the same loop. When the two meet, keep that branch's `onAngledSupport` skip and nailers for angled levels, and this branch's rule for everything else. `endFaces` is the same helper in both.

## The decision needed

1. **Approve the framing and price change** for existing designs, above all Diagonal and Herringbone with border rows (section B), whose saved quotes will reprice.
2. **Approve regenerating the golden** (`npx tsx scripts/check-deck-legacy-parity.ts --update`). Until then `npm run check:deck` fails at the parity step with 13 drifting scenarios, as expected.
3. **Optional: add Diagonal and Herringbone with 1 and 2 border rows to the golden** in the same update, so future changes to these designs are caught. The golden has none today.

Nothing merges to `main` without explicit approval; a merge deploys production.

---

Measured on 2026-09-23 from `main` @ 49b7016 (before) and this branch (after): 405 designs, the 213 parity scenarios plus 192 extra designs.
