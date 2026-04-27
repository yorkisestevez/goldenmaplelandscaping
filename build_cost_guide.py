"""Build the 2026 Simcoe County Backyard Cost Guide PDF."""
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether, PageBreak, Flowable,
)
from reportlab.lib.colors import HexColor

W, H = letter

OUTPUT = r"C:/Users/yorki/OneDrive/Desktop/Goldenmaplelandscaping.ca/golden-maple-landscaping/public/downloads/2026-simcoe-county-backyard-cost-guide.pdf"

# Brand palette — match the website
NEARBLACK   = HexColor("#0f0f0f")
DARK_BG     = HexColor("#0a0a0a")
PANEL_BG    = HexColor("#1a1814")
PANEL_ALT   = HexColor("#171510")
BORDER_DARK = HexColor("#2a2620")
GOLD        = HexColor("#d4af63")
GOLD_DEEP   = HexColor("#b8954f")
GOLD_SOFT   = HexColor("#e8c97e")
BONEWHITE   = HexColor("#f5f1e8")
MUTED       = HexColor("#a09684")
DIM         = HexColor("#5a5448")
RED_WARN    = HexColor("#c97c5a")

# Cream theme for any light pages (none in this build, but ready)
CREAM       = HexColor("#f5f1e8")

doc = SimpleDocTemplate(
    OUTPUT,
    pagesize=letter,
    leftMargin=0.7*inch,
    rightMargin=0.7*inch,
    topMargin=0.7*inch,
    bottomMargin=0.65*inch,
    title="The 2026 Simcoe County Backyard Cost Guide",
    author="Golden Maple Landscaping",
    subject="Real 2026 landscaping costs for Barrie, Innisfil, Oro-Medonte and Springwater",
)


# ---------- Style factory ----------
def S(name, **kw):
    defaults = dict(
        fontName="Helvetica",
        fontSize=10,
        textColor=BONEWHITE,
        leading=14,
        spaceBefore=0,
        spaceAfter=0,
    )
    defaults.update(kw)
    return ParagraphStyle(name, **defaults)


# Cover
s_cover_brand = S("cb",  fontName="Helvetica-Bold", fontSize=9, textColor=GOLD, alignment=TA_CENTER, leading=12)
s_cover_eye   = S("ce",  fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, alignment=TA_CENTER, leading=11)
s_cover_title = S("ct",  fontName="Times-Roman",    fontSize=42, textColor=BONEWHITE, alignment=TA_CENTER, leading=48)
s_cover_ital  = S("cti", fontName="Times-Italic",   fontSize=42, textColor=GOLD, alignment=TA_CENTER, leading=48)
s_cover_sub   = S("cs",  fontName="Helvetica",      fontSize=12, textColor=MUTED, alignment=TA_CENTER, leading=18)
s_cover_meta  = S("cm",  fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, alignment=TA_CENTER, leading=12)

# Page headings
s_eyebrow     = S("se",  fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, leading=12)
s_h1          = S("h1",  fontName="Times-Roman",    fontSize=28, textColor=BONEWHITE, leading=34)
s_h1_ital     = S("h1i", fontName="Times-Italic",   fontSize=28, textColor=GOLD, leading=34)
s_h2          = S("h2",  fontName="Times-Roman",    fontSize=18, textColor=BONEWHITE, leading=24)
s_h2_gold     = S("h2g", fontName="Times-Italic",   fontSize=18, textColor=GOLD, leading=24)
s_h3          = S("h3",  fontName="Helvetica-Bold", fontSize=11, textColor=GOLD, leading=15)
s_h3_white    = S("h3w", fontName="Helvetica-Bold", fontSize=11, textColor=BONEWHITE, leading=15)

# Body
s_body        = S("b",   fontSize=10, textColor=MUTED,    leading=15.5, spaceAfter=6)
s_body_white  = S("bw",  fontSize=10, textColor=BONEWHITE, leading=15.5, spaceAfter=6)
s_body_lg     = S("bl",  fontSize=11, textColor=MUTED,    leading=17, spaceAfter=8)
s_body_sm     = S("bsm", fontSize=8.5, textColor=MUTED,   leading=12)
s_bullet      = S("bul", fontSize=10, textColor=MUTED,    leading=15, leftIndent=14, spaceAfter=4)
s_letter      = S("lt",  fontName="Times-Roman", fontSize=11, textColor=BONEWHITE, leading=18, spaceAfter=10)
s_signature   = S("sig", fontName="Times-Italic", fontSize=13, textColor=GOLD, leading=17)
s_sig_role    = S("sr",  fontName="Helvetica", fontSize=8.5, textColor=MUTED, leading=12, letterSpacing=2)

# Pricing
s_price_lg    = S("plg", fontName="Times-Roman", fontSize=22, textColor=GOLD, alignment=TA_CENTER, leading=26)
s_price_label = S("pll", fontName="Helvetica-Bold", fontSize=8.5, textColor=BONEWHITE, alignment=TA_LEFT, leading=12)

# Tables
s_th          = S("th",  fontName="Helvetica-Bold", fontSize=8.5, textColor=NEARBLACK, alignment=TA_LEFT, leading=12)
s_td          = S("td",  fontSize=9.5, textColor=BONEWHITE, leading=13)
s_td_muted    = S("tdm", fontSize=9, textColor=MUTED, leading=13)
s_td_gold     = S("tdg", fontName="Helvetica-Bold", fontSize=10, textColor=GOLD, leading=14)

# Quotes / callouts
s_quote       = S("q",   fontName="Times-Italic", fontSize=13, textColor=GOLD_SOFT, leading=20, leftIndent=18, rightIndent=12)
s_callout     = S("co",  fontSize=10, textColor=BONEWHITE, leading=15)

# Footer / disclaimer
s_disc        = S("dsc", fontSize=7.5, textColor=DIM, leading=11, alignment=TA_CENTER)


# ---------- Helpers ----------
def sp(h=0.12):
    return Spacer(1, h * inch)


def hr_gold(w="100%", thickness=1):
    return HRFlowable(width=w, thickness=thickness, color=GOLD, spaceAfter=8, spaceBefore=8)


def hr_dim(w="100%"):
    return HRFlowable(width=w, thickness=0.5, color=BORDER_DARK, spaceAfter=4, spaceBefore=4)


def gold_dash(text):
    return Paragraph(f'<font color="#d4af63"><b>—</b></font>  {text}', s_bullet)


def check(text):
    return Paragraph(f'<font color="#d4af63"><b>✓</b></font>  {text}', s_bullet)


def cross(text):
    return Paragraph(f'<font color="#c97c5a"><b>✗</b></font>  {text}', s_bullet)


def page_eyebrow(num, label):
    """Numbered eyebrow at top of section pages."""
    num_str = f"{num:02d}"
    return Paragraph(
        f'<font color="#d4af63"><b>{num_str}</b></font>'
        f'&nbsp;&nbsp;&nbsp;<font color="#a09684" size="8">{label.upper()}</font>',
        S("pe", fontName="Helvetica-Bold", fontSize=10, textColor=GOLD, leading=14, spaceAfter=4)
    )


def section_title(line1, line2_italic=None):
    """Big serif section heading."""
    items = [Paragraph(line1, s_h1)]
    if line2_italic:
        items.append(Paragraph(line2_italic, s_h1_ital))
    items.append(sp(0.05))
    items.append(HRFlowable(width="22%", thickness=1.5, color=GOLD, spaceAfter=14, spaceBefore=4, hAlign="LEFT"))
    return items


def gold_callout(title, body, icon="◆"):
    inner = [
        Paragraph(
            f'<font color="#d4af63" size="11"><b>{icon}</b></font>'
            f'&nbsp;&nbsp;<font color="#d4af63" size="9"><b>{title.upper()}</b></font>',
            S("cot", fontName="Helvetica-Bold", fontSize=9, textColor=GOLD, leading=13, spaceAfter=6)
        ),
        Paragraph(body, s_callout),
    ]
    t = Table([[inner]], colWidths=[6.1*inch])
    t.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),PANEL_BG),
        ("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
        ("LINEBEFORE",(0,0),(0,-1),3,GOLD),
    ]))
    return t


# ---------- Page backgrounds ----------
def cover_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NEARBLACK)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # Top gold bar
    canvas.setFillColor(GOLD)
    canvas.rect(0, H - 0.05*inch, W, 0.05*inch, fill=1, stroke=0)
    # Bottom gold bar
    canvas.rect(0, 0, W, 0.05*inch, fill=1, stroke=0)

    # Decorative double rule center-top
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.5)
    canvas.line(W*0.32, H - 1.4*inch, W*0.68, H - 1.4*inch)
    canvas.setLineWidth(0.3)
    canvas.line(W*0.36, H - 1.45*inch, W*0.64, H - 1.45*inch)

    # Decorative bottom rule
    canvas.line(W*0.32, 1.0*inch, W*0.68, 1.0*inch)
    canvas.line(W*0.36, 1.05*inch, W*0.64, 1.05*inch)

    canvas.restoreState()


def page_dark(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NEARBLACK)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    # Thin top gold accent
    canvas.setFillColor(GOLD)
    canvas.rect(0, H - 0.04*inch, W, 0.04*inch, fill=1, stroke=0)

    # Footer strip
    canvas.setFillColor(DARK_BG)
    canvas.rect(0, 0, W, 0.4*inch, fill=1, stroke=0)
    canvas.setStrokeColor(BORDER_DARK)
    canvas.setLineWidth(0.3)
    canvas.line(0.5*inch, 0.4*inch, W - 0.5*inch, 0.4*inch)

    # Footer text
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.7*inch, 0.18*inch, "GOLDEN MAPLE LANDSCAPING")
    canvas.setFillColor(DIM)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawCentredString(W/2, 0.18*inch, "2026 Simcoe County Backyard Cost Guide")
    canvas.setFillColor(GOLD)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawRightString(W - 0.7*inch, 0.18*inch, f"{doc.page - 1:02d}")  # cover is page 1, internal pages start at 1

    canvas.restoreState()


def back_cover_bg(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NEARBLACK)
    canvas.rect(0, 0, W, H, fill=1, stroke=0)

    canvas.setFillColor(GOLD)
    canvas.rect(0, H - 0.05*inch, W, 0.05*inch, fill=1, stroke=0)
    canvas.rect(0, 0, W, 0.05*inch, fill=1, stroke=0)

    # Decorative center top
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.5)
    canvas.line(W*0.32, H - 1.6*inch, W*0.68, H - 1.6*inch)
    canvas.line(W*0.36, H - 1.65*inch, W*0.64, H - 1.65*inch)

    canvas.restoreState()


# Theme switcher
page_theme = {"current": "cover"}

class SetTheme(Flowable):
    def __init__(self, theme): self.theme = theme
    def wrap(self, *args): return (0, 0)
    def draw(self): page_theme["current"] = self.theme


def dynamic_bg(canvas, doc):
    t = page_theme["current"]
    if t == "cover":
        cover_bg(canvas, doc)
    elif t == "back":
        back_cover_bg(canvas, doc)
    else:
        page_dark(canvas, doc)


# ============================================================
# STORY
# ============================================================
story = []


# ----- PAGE 1: COVER -----
story.append(Spacer(1, 1.9*inch))
story.append(Paragraph("GOLDEN MAPLE LANDSCAPING", s_cover_brand))
story.append(sp(0.1))
story.append(Paragraph("· 2026 EDITION ·", s_cover_meta))
story.append(Spacer(1, 1.3*inch))

story.append(Paragraph("The 2026", s_cover_title))
story.append(Paragraph("Simcoe County", s_cover_title))
story.append(Paragraph("Backyard", s_cover_title))
story.append(Paragraph("Cost Guide.", s_cover_ital))

story.append(Spacer(1, 0.7*inch))
story.append(Paragraph(
    "Real numbers. No fluff.<br/>From 42 completed Simcoe County jobs.",
    s_cover_sub
))

story.append(Spacer(1, 0.9*inch))
story.append(Paragraph(
    "BARRIE&nbsp;&nbsp;·&nbsp;&nbsp;INNISFIL&nbsp;&nbsp;·&nbsp;&nbsp;ORO-MEDONTE&nbsp;&nbsp;·&nbsp;&nbsp;SPRINGWATER",
    s_cover_meta
))
story.append(PageBreak())


# ----- PAGE 2: WELCOME -----
story.append(SetTheme("dark"))
story.append(page_eyebrow(1, "A note from the founder"))
story.extend(section_title("A guide written", "for the homeowner."))
story.append(sp(0.1))

story.append(Paragraph(
    "If you're reading this, you're probably somewhere between Pinterest boards "
    "and a panic attack about the price tag. You've likely gathered two or three "
    "quotes that swing wildly — one says $18,000, another says $42,000 — and "
    "nobody seems willing to explain why.",
    s_letter
))
story.append(Paragraph(
    "I built this guide because that's broken. You shouldn't have to learn the "
    "hardscape industry from the inside before you can confidently choose who "
    "puts a five-figure investment into your yard. So I sat down with our last "
    "two seasons of completed jobs across Barrie, Innisfil, Oro-Medonte and "
    "Springwater and pulled out the real numbers — what we charged, what we "
    "spent, and what makes one $30,000 patio last 30 years while another fails "
    "in 30 months.",
    s_letter
))
story.append(Paragraph(
    "My philosophy is simple. Premium landscaping isn't decoration. It's "
    "engineering. The pavers you see are the easy part — the 16 inches of "
    "compacted base underneath them is where the price comes from, and where "
    "the cheap quotes always cut. Every page that follows shows you exactly "
    "what's hidden under the surface — figuratively and literally.",
    s_letter
))
story.append(Paragraph(
    "Read it cover to cover or skim the tables. Either way, you'll walk into "
    "your next contractor conversation knowing exactly what questions to ask "
    "and what numbers should look right. That's the goal.",
    s_letter
))

story.append(Spacer(1, 0.4*inch))
story.append(HRFlowable(width="22%", thickness=0.5, color=GOLD, hAlign="LEFT"))
story.append(sp(0.15))
story.append(Paragraph("Yorkis Estevez", s_signature))
story.append(Paragraph("FOUNDER  ·  GOLDEN MAPLE LANDSCAPING", s_sig_role))

story.append(PageBreak())


# ----- PAGE 3: THE 4 BACKYARD TIERS -----
story.append(page_eyebrow(2, "The four budget tiers"))
story.extend(section_title("What a backyard", "actually costs."))
story.append(Paragraph(
    "Most homeowners over-shoot or under-shoot their budget by 40%. These four "
    "tiers describe what's realistic for a fully-engineered, premium-built "
    "outdoor space in Simcoe County in 2026.",
    s_body
))
story.append(sp(0.1))


def tier_block(num, title, price, scope):
    head = Table([[
        Paragraph(f'<b>{num}</b>', S("tn", fontName="Times-Italic", fontSize=22, textColor=GOLD, leading=26)),
        [
            Paragraph(title, S("tt", fontName="Helvetica-Bold", fontSize=12, textColor=BONEWHITE, leading=16)),
            Paragraph(price, S("tp", fontName="Helvetica-Bold", fontSize=14, textColor=GOLD, leading=18)),
        ],
    ]], colWidths=[0.5*inch, 5.6*inch])
    head.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),0),
    ]))
    body = Paragraph(scope, S("ts", fontSize=9.5, textColor=MUTED, leading=14))
    inner = [head, sp(0.04), body]

    block = Table([[inner]], colWidths=[6.3*inch])
    block.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),PANEL_BG),
        ("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),14),
        ("LEFTPADDING",(0,0),(-1,-1),16),("RIGHTPADDING",(0,0),(-1,-1),16),
        ("LINEBEFORE",(0,0),(0,-1),3,GOLD),
    ]))
    return block

story.append(tier_block(
    "I.", "Front Entrance Makeover", "$15,000 — $35,000+",
    "Removal of builder-grade steps, new concrete foundation, custom stone "
    "steps, and an interlocking walkway to the driveway. The upper end adds "
    "low-voltage LED lighting, planting beds, and premium natural stone components."
))
story.append(sp(0.12))
story.append(tier_block(
    "II.", "The Functional Backyard — Patio & Fire Pit", "$25,000 — $50,000+",
    "A 400–600 sqft interlocking patio on a 14–16\" engineered base, a built-in "
    "seating wall, and a custom fire feature (wood-burning or natural gas). "
    "This is the most common starting point — enough scope to host without overshooting."
))
story.append(sp(0.12))
story.append(tier_block(
    "III.", "Elevated Outdoor Living Space", "$60,000 — $120,000+",
    "Multiple zones: dining, lounging, gas fire feature. Custom outdoor kitchen "
    "(BBQ, fridge, granite counters), structural retaining walls if the yard is "
    "sloped, and full landscape lighting. Effectively adds a new room to the home."
))
story.append(sp(0.12))
story.append(tier_block(
    "IV.", "Complete Property Transformation", "$150,000 — $300,000+",
    "Whole-property scope: front driveway, entrance, extensive grading and "
    "drainage solutions, multi-level backyard terraces, pool surrounds, and "
    "fully automated lighting and irrigation systems."
))

story.append(PageBreak())


# ----- PAGE 4: INTERLOCKING & PATIO PRICING TABLE -----
story.append(page_eyebrow(3, "Interlocking & patio pricing"))
story.extend(section_title("Six common projects,", "by the numbers."))
story.append(Paragraph(
    "Installed prices for premium-built interlocking projects across Simcoe County "
    "in 2026. Includes engineered base, materials, and finishing — assumes "
    "standard site access and Techo-Bloc or Permacon products.",
    s_body
))
story.append(sp(0.1))

pricing_rows = [
    ["Project Type", "Typical Size", "2026 Range"],
    ["Backyard patio", "150–300 sqft", "$9,000 — $18,000"],
    ["Large patio with features", "300–600 sqft", "$18,000 — $40,000"],
    ["Front walkway", "50–120 sqft", "$4,000 — $9,000"],
    ["Single driveway", "400–600 sqft", "$20,000 — $35,000"],
    ["Double driveway", "600–900 sqft", "$30,000 — $50,000"],
    ["Pool surround", "200–500 sqft", "$15,000 — $35,000"],
]
header_para = lambda t: Paragraph(f"<b>{t}</b>", s_th)
data_para_l = lambda t: Paragraph(t, S("dl", fontName="Helvetica", fontSize=10, textColor=BONEWHITE, leading=14))
data_para_m = lambda t: Paragraph(t, S("dm", fontName="Helvetica", fontSize=10, textColor=MUTED, leading=14))
data_para_g = lambda t: Paragraph(t, S("dg", fontName="Helvetica-Bold", fontSize=10.5, textColor=GOLD, leading=14))

rows_built = [[header_para(c) for c in pricing_rows[0]]]
for r in pricing_rows[1:]:
    rows_built.append([data_para_l(r[0]), data_para_m(r[1]), data_para_g(r[2])])

t = Table(rows_built, colWidths=[2.5*inch, 1.7*inch, 2.1*inch])
t.setStyle(TableStyle([
    ("BACKGROUND",     (0,0), (-1,0), GOLD),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [PANEL_BG, PANEL_ALT]),
    ("TOPPADDING",     (0,0), (-1,-1), 11),
    ("BOTTOMPADDING",  (0,0), (-1,-1), 11),
    ("LEFTPADDING",    (0,0), (-1,-1), 14),
    ("RIGHTPADDING",   (0,0), (-1,-1), 14),
    ("VALIGN",         (0,0), (-1,-1), "MIDDLE"),
    ("LINEBELOW",      (0,0), (-1,-1), 0.3, BORDER_DARK),
    ("LINEBEFORE",     (0,0), (0,-1), 3, GOLD),
]))
story.append(t)
story.append(sp(0.25))

story.append(gold_callout(
    "Per-square-foot benchmark",
    "Premium-built interlocking installs in our region range from "
    "<font color='#d4af63'><b>$55–$85 per square foot installed</b></font> in 2026 — "
    "inclusive of engineered base prep, materials, polymeric jointing, and finishing. "
    "Anything quoted under $40/sqft is cutting the base prep, the materials, or both.",
))

story.append(sp(0.2))

story.append(Paragraph(
    "<i>Why the wide ranges?</i> Site access, base depth, paver choice, "
    "and whether your yard is flat or sloped each move the final price by 15–30%. "
    "The next pages break down each lever.",
    s_body
))

story.append(PageBreak())


# ----- PAGE 5: MATERIAL COST LADDER -----
story.append(page_eyebrow(4, "Materials"))
story.extend(section_title("The material cost", "ladder."))
story.append(Paragraph(
    "Pavers are the single biggest material line on a patio quote. Here's what "
    "each tier of paver actually costs per square foot — and what you give up "
    "going down-market.",
    s_body
))
story.append(sp(0.15))

material_rows = [
    ["Standard concrete pavers", "$45 — $60/sqft", "Budget patios and walkways. Builder-grade colour and finish — fades within 2–3 years."],
    ["Techo-Bloc premium", "$60 — $80/sqft", "Mid-to-high patios and driveways. Lifetime transferable warranty engineered for Ontario freeze-thaw."],
    ["Porcelain pavers", "$75 — $100/sqft", "Modern outdoor living and pool decks. Specialized lifting equipment + flawless base required."],
    ["Natural stone", "$80 — $120/sqft", "High-end feature areas, steps, and vertical detail. Each stone unique."],
]

mat_built = [[
    Paragraph("<b>Material</b>", s_th),
    Paragraph("<b>2026 Price</b>", s_th),
    Paragraph("<b>Best Use</b>", s_th),
]]
for r in material_rows:
    mat_built.append([
        Paragraph(r[0], S("ml", fontName="Helvetica-Bold", fontSize=10, textColor=BONEWHITE, leading=14)),
        Paragraph(r[1], S("mp", fontName="Helvetica-Bold", fontSize=10, textColor=GOLD, leading=14)),
        Paragraph(r[2], S("md", fontSize=9, textColor=MUTED, leading=12.5)),
    ])

mt = Table(mat_built, colWidths=[1.7*inch, 1.4*inch, 3.2*inch])
mt.setStyle(TableStyle([
    ("BACKGROUND",     (0,0), (-1,0), GOLD),
    ("ROWBACKGROUNDS", (0,1), (-1,-1), [PANEL_BG, PANEL_ALT]),
    ("TOPPADDING",     (0,0), (-1,-1), 12),
    ("BOTTOMPADDING",  (0,0), (-1,-1), 12),
    ("LEFTPADDING",    (0,0), (-1,-1), 14),
    ("RIGHTPADDING",   (0,0), (-1,-1), 14),
    ("VALIGN",         (0,0), (-1,-1), "TOP"),
    ("LINEBELOW",      (0,0), (-1,-1), 0.3, BORDER_DARK),
    ("LINEBEFORE",     (0,0), (0,-1), 3, GOLD),
]))
story.append(mt)
story.append(sp(0.25))

story.append(gold_callout(
    "Our recommendation",
    "For 90% of Simcoe County patios, <b>Techo-Bloc</b> or <b>Permacon</b> hits the "
    "right balance — premium colour mixes that don't fade, lifetime transferable "
    "warranty, and engineering specifically tuned for Ontario freeze-thaw cycles. "
    "Skip the builder-grade tier unless you genuinely don't care about the patio "
    "in 5 years.",
    icon="◆",
))

story.append(PageBreak())


# ----- PAGE 6: SAMPLE PATIO SCENARIOS -----
story.append(page_eyebrow(5, "Sample budgets"))
story.extend(section_title("Three patios,", "three budgets."))
story.append(Paragraph(
    "Same 400 sqft footprint, three very different builds. This is how the "
    "decisions compound when you choose materials, edges, and features.",
    s_body
))
story.append(sp(0.15))


def scenario_card(label, price, title, body):
    inner = [
        Paragraph(label, S("scl", fontName="Helvetica-Bold", fontSize=8.5, textColor=GOLD, leading=12)),
        sp(0.04),
        Paragraph(price, S("scp", fontName="Times-Roman", fontSize=22, textColor=BONEWHITE, leading=26)),
        sp(0.04),
        Paragraph(title, S("sct", fontName="Helvetica-Bold", fontSize=10.5, textColor=BONEWHITE, leading=14)),
        sp(0.06),
        Paragraph(body, S("scb", fontSize=9, textColor=MUTED, leading=13.5)),
    ]
    card = Table([[inner]], colWidths=[2.0*inch])
    card.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),PANEL_BG),
        ("TOPPADDING",(0,0),(-1,-1),16),("BOTTOMPADDING",(0,0),(-1,-1),16),
        ("LEFTPADDING",(0,0),(-1,-1),14),("RIGHTPADDING",(0,0),(-1,-1),14),
        ("LINEABOVE",(0,0),(-1,0),3,GOLD),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    return card


sc_row = Table([[
    scenario_card("FUNCTIONAL", "≈ $15,000", "The Minimum",
        "Standard pavers, simple square shape, flat yard with good access. "
        "Proper 14\" engineered base. The right floor for entry-level outdoor living."),
    scenario_card("ENTERTAINER", "≈ $25,000", "The Sweet Spot",
        "Techo-Bloc / Unilock Beacon Hill premium pavers, contrasting border, "
        "curved edges, matching stone fire pit. Where most homeowners land."),
    scenario_card("LUXURY", "$40,000+", "Outdoor Room",
        "Large-format premium slabs, slight slope with seating wall, integrated "
        "LED lighting, built-in natural-gas fire feature. Hosts dinner parties."),
]], colWidths=[2.05*inch, 2.05*inch, 2.05*inch])
sc_row.setStyle(TableStyle([
    ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
    ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
    ("VALIGN",(0,0),(-1,-1),"TOP"),
]))
story.append(sc_row)
story.append(sp(0.3))

# Worked example
story.append(Paragraph("A worked example.", s_h2))
story.append(sp(0.05))
story.append(Paragraph(
    "What it actually looks like to price a real backyard from a recent Innisfil project.",
    s_body
))
story.append(sp(0.1))

example_rows = [
    ["Line Item", "Calculation", "Cost"],
    ["350 sqft Techo-Bloc patio", "350 × $70/sqft installed", "$24,500"],
    ["3 stone steps (front of patio)", "Custom-cut, mortared", "$2,500"],
    ["Low-voltage LED landscape lighting", "10 fixtures + transformer", "$3,000"],
    ["TOTAL", "Premium turn-key install", "≈ $30,000"],
]
ex_built = [[header_para(c) for c in example_rows[0]]]
for i, r in enumerate(example_rows[1:]):
    is_total = i == len(example_rows) - 2
    ex_built.append([
        Paragraph(f"<b>{r[0]}</b>" if is_total else r[0], S("xa", fontName="Helvetica" + ("-Bold" if is_total else ""), fontSize=10, textColor=BONEWHITE, leading=14)),
        Paragraph(r[1], S("xb", fontSize=9.5, textColor=MUTED, leading=13)),
        Paragraph(f"<b>{r[2]}</b>", S("xc", fontName="Helvetica-Bold", fontSize=10.5, textColor=GOLD, leading=14)),
    ])

ext = Table(ex_built, colWidths=[2.6*inch, 2.4*inch, 1.3*inch])
ext.setStyle(TableStyle([
    ("BACKGROUND",     (0,0), (-1,0), GOLD),
    ("ROWBACKGROUNDS", (0,1), (-1,-2), [PANEL_BG, PANEL_ALT]),
    ("BACKGROUND",     (0,-1), (-1,-1), HexColor("#221d14")),
    ("TOPPADDING",     (0,0), (-1,-1), 11),
    ("BOTTOMPADDING",  (0,0), (-1,-1), 11),
    ("LEFTPADDING",    (0,0), (-1,-1), 14),
    ("RIGHTPADDING",   (0,0), (-1,-1), 14),
    ("VALIGN",         (0,0), (-1,-1), "MIDDLE"),
    ("LINEBELOW",      (0,0), (-1,-1), 0.3, BORDER_DARK),
    ("LINEABOVE",      (0,-1), (-1,-1), 1, GOLD),
    ("LINEBEFORE",     (0,0), (0,-1), 3, GOLD),
]))
story.append(ext)

story.append(PageBreak())


# ----- PAGE 7: WHAT DRIVES THE PRICE UP -----
story.append(page_eyebrow(6, "Cost drivers"))
story.extend(section_title("What actually moves", "the number."))
story.append(Paragraph(
    "Eight variables explain why two patios of identical size can quote $14K "
    "apart. Knowing them lets you compare apples to apples.",
    s_body
))
story.append(sp(0.15))

drivers = [
    ("Base preparation",
     "Professional standard: 12–16\" excavation + 8–12\" compacted Granular A "
     "+ 1\" HPB or sand. Cheap installers cut to 4–6\" — saves on excavation, "
     "disposal and aggregate, guarantees heaving by year two."),
    ("Geotextile & geogrid",
     "Geotextile separates clay soil from the stone base (mandatory on most "
     "Simcoe County yards). Geogrid ties retaining walls into the earth. "
     "Skipping them is the #1 reason walls lean by 18 months."),
    ("Sloped lot premium",
     "If your yard slopes, expect <b>+15–25%</b> on the base price for extra "
     "excavation, retaining, and stepped designs. South Barrie clay slopes are "
     "particularly demanding."),
    ("Restricted access",
     "A 3-foot side gate turns a 4-day install into a 9-day install. Material "
     "moves by hand or mini-excavator instead of skid-steer. Labour cost can "
     "double on the same square footage."),
    ("Steps",
     "<b>$1,500 — $4,000 per set</b>, depending on stone type, custom cuts, "
     "and whether they're free-standing or mortared into a foundation."),
    ("Built-in lighting",
     "<b>$2,000 — $5,000</b> for In-Lite or Kichler LED systems including "
     "fixtures, wiring, transformer, and timers. Done right, transforms how "
     "the space reads at night."),
    ("Seat walls",
     "<b>$3,000 — $8,000</b> for a built-in seat wall with cap stones. "
     "Adds permanent seating without consuming patio square footage."),
    ("Romex jointing premium",
     "Polymer-infused jointing (vs. standard polymeric sand) adds <b>$3–5/sqft</b> "
     "but eliminates ant-pulling, weed germination, and joint washout. Worth it "
     "in shaded yards."),
    ("Perimeter retaining wall",
     "A 2-foot retaining wall around a sloped patio adds <b>$5,000 — $10,000</b>. "
     "Often necessary in Oro-Medonte and Springwater builds where natural grade falls."),
]

driver_rows = []
for label, body in drivers:
    driver_rows.append([
        Paragraph(f"<b>{label}</b>", S("dl2", fontName="Helvetica-Bold", fontSize=10, textColor=GOLD, leading=14)),
        Paragraph(body, S("db2", fontSize=9.5, textColor=MUTED, leading=13.5)),
    ])

dt = Table(driver_rows, colWidths=[1.7*inch, 4.6*inch])
dt.setStyle(TableStyle([
    ("ROWBACKGROUNDS", (0,0), (-1,-1), [PANEL_BG, PANEL_ALT]),
    ("TOPPADDING",     (0,0), (-1,-1), 10),
    ("BOTTOMPADDING",  (0,0), (-1,-1), 10),
    ("LEFTPADDING",    (0,0), (-1,-1), 14),
    ("RIGHTPADDING",   (0,0), (-1,-1), 14),
    ("VALIGN",         (0,0), (-1,-1), "TOP"),
    ("LINEBEFORE",     (0,0), (0,-1), 3, GOLD),
    ("LINEBELOW",      (0,0), (-1,-1), 0.3, BORDER_DARK),
]))
story.append(dt)

story.append(PageBreak())


# ----- PAGE 8: ALTERNATIVE PATIO MATERIALS -----
story.append(page_eyebrow(7, "Patio surface comparison"))
story.extend(section_title("If not interlocking,", "then what?"))
story.append(Paragraph(
    "How interlocking pavers stack up against the four most common alternatives "
    "in Simcoe County. Lifespan and maintenance assume Ontario freeze-thaw conditions.",
    s_body
))
story.append(sp(0.15))

alt_rows = [
    ["Material", "Price/sqft", "Lifespan", "Maintenance"],
    ["Interlocking stone", "$55 — $85", "25 — 30 yrs", "Low"],
    ["Stamped concrete", "$20 — $35", "10 — 15 yrs", "Medium (will crack)"],
    ["Poured concrete", "$15 — $25", "15 — 20 yrs", "Low"],
    ["Natural flagstone", "$40 — $70", "30+ yrs", "Low"],
    ["Wood deck", "$35 — $65", "15 — 20 yrs", "High (annual stain)"],
]

alt_built = [[header_para(c) for c in alt_rows[0]]]
for i, r in enumerate(alt_rows[1:]):
    is_first = i == 0
    name_style = S("alt1", fontName="Helvetica-Bold", fontSize=10, textColor=GOLD if is_first else BONEWHITE, leading=14)
    alt_built.append([
        Paragraph(r[0], name_style),
        Paragraph(r[1], S("alt2", fontName="Helvetica" + ("-Bold" if is_first else ""), fontSize=9.5, textColor=GOLD if is_first else MUTED, leading=13)),
        Paragraph(r[2], S("alt3", fontSize=9.5, textColor=BONEWHITE if is_first else MUTED, leading=13)),
        Paragraph(r[3], S("alt4", fontSize=9.5, textColor=BONEWHITE if is_first else MUTED, leading=13)),
    ])

at = Table(alt_built, colWidths=[2.0*inch, 1.4*inch, 1.4*inch, 1.5*inch])
at.setStyle(TableStyle([
    ("BACKGROUND",     (0,0), (-1,0), GOLD),
    ("BACKGROUND",     (0,1), (-1,1), HexColor("#221d14")),
    ("ROWBACKGROUNDS", (0,2), (-1,-1), [PANEL_BG, PANEL_ALT]),
    ("TOPPADDING",     (0,0), (-1,-1), 11),
    ("BOTTOMPADDING",  (0,0), (-1,-1), 11),
    ("LEFTPADDING",    (0,0), (-1,-1), 14),
    ("RIGHTPADDING",   (0,0), (-1,-1), 14),
    ("VALIGN",         (0,0), (-1,-1), "MIDDLE"),
    ("LINEBELOW",      (0,1), (-1,1), 1, GOLD),
    ("LINEBELOW",      (0,2), (-1,-1), 0.3, BORDER_DARK),
    ("LINEBEFORE",     (0,0), (0,-1), 3, GOLD),
]))
story.append(at)
story.append(sp(0.3))

story.append(gold_callout(
    "The hidden truth about stamped concrete",
    "Stamped concrete is <i>not</i> a question of <b>if</b> it cracks, only <b>when</b>. "
    "Ontario's freeze-thaw cycles guarantee it. Interlocking pavers <b>flex</b> with "
    "the freeze-thaw — individual pavers move slightly, the patio stays intact. "
    "That's the whole reason interlocking became the regional standard.",
    icon="⚠"
))

story.append(PageBreak())


# ----- PAGE 9: FIVE HIDDEN COSTS -----
story.append(page_eyebrow(8, "Cheap quote autopsy"))
story.extend(section_title("The five hidden costs", "in a low quote."))
story.append(Paragraph(
    "When you see one quote 40% under the others, it's not a deal — it's "
    "five specific cuts that won't show up until year two.",
    s_body
))
story.append(sp(0.15))

hidden = [
    ("01", "The 6-inch base",
     "The cheap contractor digs 6\" instead of 14–16\". Saves on excavation, "
     "disposal, and aggregate. Day one: identical to the premium build. "
     "Year two: heaved, sunken, cracked."),
    ("02", "Skipped geotextile & geogrid",
     "Geotextile fabric separates clay from stone. Geogrid ties retaining "
     "walls into the earth. Both cost money and time — both get cut. "
     "Result: patios that pump clay up through the joints, walls that lean at 18 months."),
    ("03", "Poor drainage planning",
     "A real install includes 1.5–2% slope, perforated drain tiles, and water-flow "
     "assessment. Cheap installs trap water against your foundation (flooded basements) "
     "or pond it on the surface (frozen pavers, cracked stone)."),
    ("04", "Bait-and-switch materials",
     "The quote says 'premium pavers.' The truck arrives with builder-grade product "
     "from a big-box store. Same shape — different mix, different finish, fades in "
     "two seasons. Always demand the exact brand and line in writing."),
    ("05", "No WSIB, no liability insurance",
     "Premium contractors carry WSIB ($) and multimillion-dollar liability ($$). "
     "The unmarked truck doing it cash for $18K? Often neither. If a worker injures "
     "themselves on your property, <b>you can be held personally liable</b> for "
     "their medical bills and lost wages."),
]

for num, title, body in hidden:
    block = Table([[
        Paragraph(num, S("hn", fontName="Times-Italic", fontSize=22, textColor=GOLD, leading=26)),
        [
            Paragraph(title, S("ht", fontName="Helvetica-Bold", fontSize=10.5, textColor=BONEWHITE, leading=14)),
            sp(0.03),
            Paragraph(body, S("hb", fontSize=9, textColor=MUTED, leading=13)),
        ],
    ]], colWidths=[0.5*inch, 5.75*inch])
    block.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),PANEL_BG),
        ("TOPPADDING",(0,0),(-1,-1),9),("BOTTOMPADDING",(0,0),(-1,-1),9),
        ("LEFTPADDING",(0,0),(-1,-1),14),("RIGHTPADDING",(0,0),(-1,-1),14),
        ("LINEBEFORE",(0,0),(0,-1),3,GOLD),
        ("VALIGN",(0,0),(-1,-1),"TOP"),
    ]))
    story.append(block)
    story.append(sp(0.05))

# Math box on its own page with proper context
story.append(PageBreak())
story.append(page_eyebrow(9, "The math"))
story.extend(section_title("The true cost", "of the bargain."))
story.append(Paragraph(
    "Half of our summer schedule is spent ripping out cheap patios and failing "
    "retaining walls that were installed two or three years prior. Here's the "
    "math we walk new clients through when they bring us a competing low quote.",
    s_body
))
story.append(sp(0.2))

math_box = Table([[[
    Paragraph(
        '<font color="#d4af63"><b>THE TRUE COST OF DOING IT TWICE</b></font>',
        S("mh", fontName="Helvetica-Bold", fontSize=9, textColor=GOLD, leading=13, alignment=TA_CENTER)
    ),
    sp(0.1),
    Paragraph(
        '<font size="11" color="#a09684">Initial cheap install:</font> '
        '<font size="14" color="#f5f1e8"><b>$18,000</b></font>'
        '&nbsp;&nbsp;&nbsp;<font color="#5a5448">+</font>&nbsp;&nbsp;&nbsp;'
        '<font size="11" color="#a09684">Demo &amp; disposal:</font> '
        '<font size="14" color="#f5f1e8"><b>$5,000</b></font>'
        '&nbsp;&nbsp;&nbsp;<font color="#5a5448">+</font>&nbsp;&nbsp;&nbsp;'
        '<font size="11" color="#a09684">Proper rebuild:</font> '
        '<font size="14" color="#f5f1e8"><b>$35,000</b></font>',
        S("mb", fontSize=10, alignment=TA_CENTER, leading=18)
    ),
    sp(0.08),
    HRFlowable(width="60%", thickness=0.5, color=GOLD, hAlign="CENTER"),
    sp(0.04),
    Paragraph(
        '<font size="9" color="#a09684">TRUE COST OF THE "BARGAIN"</font><br/>'
        '<font size="22" color="#d4af63"><b>$58,000</b></font><br/>'
        '<font size="8.5" color="#5a5448"><i>vs. $35,000 done right the first time</i></font>',
        S("mt", alignment=TA_CENTER, leading=20)
    ),
]]], colWidths=[6.3*inch])
math_box.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,-1),HexColor("#1f1a10")),
    ("TOPPADDING",(0,0),(-1,-1),18),("BOTTOMPADDING",(0,0),(-1,-1),20),
    ("LEFTPADDING",(0,0),(-1,-1),20),("RIGHTPADDING",(0,0),(-1,-1),20),
    ("LINEABOVE",(0,0),(-1,0),1,GOLD),
    ("LINEBELOW",(0,0),(-1,-1),1,GOLD),
]))
story.append(math_box)
story.append(sp(0.3))

story.append(Paragraph(
    '"You aren\'t saving $17,000 by choosing the lowest bid. You\'re paying an '
    '$18,000 deposit on a headache you\'ll have to fix in three years."',
    s_quote
))
story.append(sp(0.05))
story.append(Paragraph(
    "— YORKIS ESTEVEZ, FOUNDER",
    S("qa", fontName="Helvetica-Bold", fontSize=8, textColor=MUTED, leading=12, leftIndent=18)
))

story.append(PageBreak())


# ----- PAGE 11: RED FLAGS & FOUR QUESTIONS -----
story.append(page_eyebrow(10, "Quote evaluation"))
story.extend(section_title("Red flags &", "the four questions."))
story.append(sp(0.05))

# Two columns: red flags + four questions
left_col = [
    Paragraph("Six red flags in a quote.", s_h2),
    sp(0.1),
    cross("Per-sqft prices under $40 installed"),
    cross("No mention of base depth or aggregate type"),
    cross('"We\'ll figure it out on site"'),
    cross("No written multi-year warranty"),
    cross("Deposit requested over 50% upfront"),
    cross("No proof of WSIB clearance or liability insurance"),
    sp(0.15),
    Paragraph(
        "<i>Standard deposit structure is 10–30% upfront, balance in milestone payments "
        "tied to base completion, paver delivery, and final cleanup.</i>",
        s_body_sm
    ),
]

right_col = [
    Paragraph("Four questions.", s_h2),
    Paragraph("<i>In writing, before you sign.</i>", S("rs", fontName="Times-Italic", fontSize=10, textColor=MUTED, leading=14, spaceAfter=10)),
    Paragraph(
        '<font color="#d4af63"><b>Q1.</b></font>&nbsp; '
        'Exactly how many inches deep will you excavate for the base?',
        S("q1", fontSize=10, textColor=BONEWHITE, leading=15, spaceAfter=10)
    ),
    Paragraph(
        '<font color="#d4af63"><b>Q2.</b></font>&nbsp; '
        'Are you using 3/4" clear stone or limestone screenings ("gravel dust") for the base?',
        S("q2", fontSize=10, textColor=BONEWHITE, leading=15, spaceAfter=10)
    ),
    Paragraph(
        '<font color="#d4af63"><b>Q3.</b></font>&nbsp; '
        'Can you provide a current WSIB clearance certificate today?',
        S("q3", fontSize=10, textColor=BONEWHITE, leading=15, spaceAfter=10)
    ),
    Paragraph(
        '<font color="#d4af63"><b>Q4.</b></font>&nbsp; '
        'Does your contract include a written multi-year warranty covering sinking and settlement?',
        S("q4", fontSize=10, textColor=BONEWHITE, leading=15, spaceAfter=10)
    ),
    sp(0.1),
    Paragraph(
        "<i>If the answer to any of these is hesitation, vagueness, or a "
        "subject change — walk.</i>",
        S("rsf", fontName="Times-Italic", fontSize=9.5, textColor=GOLD_SOFT, leading=14)
    ),
]

cols = Table([[left_col, right_col]], colWidths=[3.05*inch, 3.25*inch])
cols.setStyle(TableStyle([
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(0,-1),0),
    ("RIGHTPADDING",(0,0),(0,-1),16),
    ("LEFTPADDING",(1,0),(1,-1),16),
    ("RIGHTPADDING",(1,0),(1,-1),0),
    ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
    ("LINEBETWEEN",(0,0),(-1,-1),0.5,BORDER_DARK),
]))
story.append(cols)
story.append(sp(0.3))

story.append(gold_callout(
    "The Yorkis rule",
    "If a contractor can't answer all four of these in under 60 seconds without "
    "checking notes — they don't actually know how to build a patio that lasts. "
    "Save the conversation, end the call, move on.",
    icon="◆",
))

story.append(PageBreak())


# ----- PAGE 12: BUILD SEASON & BUDGETING -----
story.append(page_eyebrow(11, "Timing & budget"))
story.extend(section_title("When to build,", "what to budget."))
story.append(sp(0.05))

# Two-column layout: timeline + budget rule
timeline_col = [
    Paragraph("Build season timing.", s_h2),
    sp(0.1),
    Paragraph(
        "Simcoe County's hardscape season runs <b>April through November</b>. "
        "Premium contractors fill their April–June slots by February. If you "
        "want first-half-of-season install for 2026, the smart booking window is:",
        s_body
    ),
    sp(0.15),
    Paragraph(
        '<font color="#d4af63"><b>Jan — Mar:</b></font> Design phase, '
        'material selection, contract signed. Lock April–May install.',
        S("tl1", fontSize=9.5, textColor=BONEWHITE, leading=14, spaceAfter=8)
    ),
    Paragraph(
        '<font color="#d4af63"><b>Apr — May:</b></font> Early-season install. '
        'Best weather window, highest contractor availability.',
        S("tl2", fontSize=9.5, textColor=BONEWHITE, leading=14, spaceAfter=8)
    ),
    Paragraph(
        '<font color="#d4af63"><b>Jun — Aug:</b></font> Peak season. '
        'Premium crews at full capacity. Project lead times stretch to 6–10 weeks.',
        S("tl3", fontSize=9.5, textColor=BONEWHITE, leading=14, spaceAfter=8)
    ),
    Paragraph(
        '<font color="#d4af63"><b>Sep — Nov:</b></font> Late-season install. '
        'Cooler temperatures are actually ideal for paver setting and joint stabilization.',
        S("tl4", fontSize=9.5, textColor=BONEWHITE, leading=14, spaceAfter=8)
    ),
]

budget_col = [
    Paragraph("How much to budget.", s_h2),
    sp(0.1),
    Paragraph(
        "The <b>Appraisal Institute of Canada</b> recommends budgeting "
        "<b>10–15% of your home's total value</b> for a complete landscape "
        "renovation. For a $900K Barrie home, that's $90K–$135K range — "
        "which lines up almost exactly with our Tier III \"Elevated Outdoor "
        "Living\" budget.",
        s_body
    ),
    sp(0.1),
    Paragraph(
        "Most homeowners under-budget on first-time projects by 25–40% because "
        "they price only the patio, forgetting drainage, lighting, plantings, "
        "and finishing. Multiply your patio quote by 1.4 for a realistic total.",
        s_body
    ),
]

tb_row = Table([[timeline_col, budget_col]], colWidths=[3.05*inch, 3.25*inch])
tb_row.setStyle(TableStyle([
    ("VALIGN",(0,0),(-1,-1),"TOP"),
    ("LEFTPADDING",(0,0),(0,-1),0),("RIGHTPADDING",(0,0),(0,-1),16),
    ("LEFTPADDING",(1,0),(1,-1),16),("RIGHTPADDING",(1,0),(1,-1),0),
    ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0),
    ("LINEBETWEEN",(0,0),(-1,-1),0.5,BORDER_DARK),
]))
story.append(tb_row)
story.append(sp(0.3))

story.append(gold_callout(
    "Free 15-minute discovery call",
    "Before you spend $200 on anyone's design consultation — including ours — "
    "we offer a <b>free 15-minute phone discovery call</b>. Honest scope assessment, "
    "honest budget feedback, no pressure. If your project isn't a fit for what "
    "we do, we'll tell you and recommend someone better. Available year-round.",
    icon="◆",
))

story.append(PageBreak())


# ----- PAGE 12: FINAL CTA / BACK COVER -----
story.append(SetTheme("back"))
story.append(Spacer(1, 1.7*inch))

story.append(Paragraph("GOLDEN MAPLE LANDSCAPING", s_cover_brand))
story.append(sp(0.4))

story.append(Paragraph("Ready to talk", s_cover_title))
story.append(Paragraph("about your", s_cover_title))
story.append(Paragraph("project?", s_cover_ital))

story.append(Spacer(1, 0.6*inch))
story.append(Paragraph(
    "A free 15-minute discovery call with the founder.<br/>"
    "Honest scope. Honest budget. No pressure.",
    s_cover_sub
))

story.append(Spacer(1, 0.5*inch))

# Three-column contact bar
contact_bar = Table([[
    Paragraph("CALL", S("c1l", fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, alignment=TA_CENTER, leading=12)),
    Paragraph("EMAIL", S("c2l", fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, alignment=TA_CENTER, leading=12)),
    Paragraph("WEB", S("c3l", fontName="Helvetica-Bold", fontSize=8, textColor=GOLD, alignment=TA_CENTER, leading=12)),
], [
    Paragraph("(705) 500-3581", S("c1v", fontName="Times-Roman", fontSize=14, textColor=BONEWHITE, alignment=TA_CENTER, leading=18)),
    Paragraph("yorkis@<br/>goldenmaplelandscaping.ca", S("c2v", fontName="Times-Roman", fontSize=11, textColor=BONEWHITE, alignment=TA_CENTER, leading=14)),
    Paragraph("goldenmaplelandscaping.ca", S("c3v", fontName="Times-Roman", fontSize=11, textColor=BONEWHITE, alignment=TA_CENTER, leading=18)),
]], colWidths=[2.16*inch, 2.16*inch, 2.16*inch])
contact_bar.setStyle(TableStyle([
    ("BACKGROUND",(0,0),(-1,-1),PANEL_BG),
    ("TOPPADDING",(0,0),(-1,0),14),("BOTTOMPADDING",(0,0),(-1,0),4),
    ("TOPPADDING",(0,1),(-1,1),4),("BOTTOMPADDING",(0,1),(-1,1),16),
    ("LEFTPADDING",(0,0),(-1,-1),8),("RIGHTPADDING",(0,0),(-1,-1),8),
    ("LINEBETWEEN",(0,0),(-1,-1),0.5,BORDER_DARK),
    ("LINEABOVE",(0,0),(-1,0),1.5,GOLD),
    ("LINEBELOW",(0,1),(-1,1),1.5,GOLD),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
]))
story.append(contact_bar)
story.append(sp(0.4))

# Trust marks
trust_bar = Table([[
    Paragraph('<font color="#d4af63"><b>◆</b></font>&nbsp;&nbsp;<b>WSIB CERTIFIED</b>',
              S("t1", fontName="Helvetica-Bold", fontSize=9, textColor=BONEWHITE, alignment=TA_CENTER, leading=13)),
    Paragraph('<font color="#d4af63"><b>◆</b></font>&nbsp;&nbsp;<b>$5M LIABILITY</b>',
              S("t2", fontName="Helvetica-Bold", fontSize=9, textColor=BONEWHITE, alignment=TA_CENTER, leading=13)),
    Paragraph('<font color="#d4af63"><b>◆</b></font>&nbsp;&nbsp;<b>5-YR WARRANTY</b>',
              S("t3", fontName="Helvetica-Bold", fontSize=9, textColor=BONEWHITE, alignment=TA_CENTER, leading=13)),
]], colWidths=[2.16*inch, 2.16*inch, 2.16*inch])
trust_bar.setStyle(TableStyle([
    ("TOPPADDING",(0,0),(-1,-1),12),("BOTTOMPADDING",(0,0),(-1,-1),12),
    ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
    ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
]))
story.append(trust_bar)

story.append(Spacer(1, 0.5*inch))
story.append(HRFlowable(width="40%", thickness=0.5, color=GOLD, hAlign="CENTER"))
story.append(sp(0.15))
story.append(Paragraph(
    "Prices reflect 2026 Simcoe County market and assume premium materials, "
    "engineered base preparation, and full-service installation.<br/>"
    "All projects subject to final scope and site assessment.",
    s_disc
))
story.append(sp(0.3))
story.append(Paragraph(
    "© 2026 GOLDEN MAPLE LANDSCAPING  ·  BARRIE, ONTARIO  ·  ALL RIGHTS RESERVED",
    s_disc
))


# ============================================================
# BUILD
# ============================================================
doc.build(story, onFirstPage=dynamic_bg, onLaterPages=dynamic_bg)
print(f"PDF built: {OUTPUT}")

# Audit
import os
size = os.path.getsize(OUTPUT)
print(f"Size: {size/1024:.1f} KB")

import pdfplumber
with pdfplumber.open(OUTPUT) as pdf:
    print(f"Total pages: {len(pdf.pages)}")
    for i, page in enumerate(pdf.pages):
        words = page.extract_words()
        main = [w for w in words if w['top'] < 760]
        if main:
            max_y = max(w['bottom'] for w in main)
            gap = 760 - max_y
            status = '✅' if gap < 80 else ('⚠' if gap < 150 else '✗')
            first = ' '.join(w['text'] for w in sorted(main, key=lambda w: w['top'])[:5])
            print(f"{status} P{i+1:02d} gap={gap:3.0f}pt | {first[:60]}")
