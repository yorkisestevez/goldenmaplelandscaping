# DeckCraft for contractors: marketing plan (draft for owner go/no-go)

Status: draft, 2026-09-23. Required before any white-label build (marketing-plan rule). Nothing here is
live, paid or sent. Every number below is a hypothesis to test, not a claim.

## ICP and core offer

- **Who:** small residential deck and landscape contractors (1–15 people) in Ontario first, then Canada.
  They sell decks from site visits and phone calls, lose evenings to re-drawing and re-pricing, and get
  few qualified web leads.
- **Core offer:** "Your own 3D deck designer on your website, priced from your price book, with every
  finished design landing in your inbox as a qualified lead." Customers design, see an honest planning
  estimate (unpriced items shown as supplier quotes, never $0), and send the design with one click.
- **Proof point:** Golden Maple itself: deck designer live on goldenmaplelandscaping.ca, sent designs
  arriving in its CRM with a reopen link, summary and estimate.

## Channels (pick two)

1. **Direct, warm-first outreach to contractors** (drafts only, owner approves every message): Ontario
   deck builders with an existing website, starting with suppliers' contractor networks. Offer: a
   personal demo built with their logo and a sample of their prices.
2. **Content and search for contractors:** "deck design software for contractors", "3D deck designer
   for my website", "deck estimate tool": one landing page plus how-to articles through the existing
   blog pipeline.

## Conversion path

Landing page → live demo (a fictional brand, never a real company's) → 14-day trial on their own
subdomain or an embed snippet → paid plan. The trial is the product itself: their designer, their price
book, leads to their email.

## Retention path

A monthly "your designer this month" email: designs started, designs sent, leads by value, most-used
options. Leads are the value; the report makes it visible. Price-book updates stay one-click.

## Measurement

Funnel events already exist in DeckCraft (steps, features, sends); per tenant they become: visits →
designs started → designs sent → leads contacted (tenant-reported). Business funnel: demo booked →
trial started → trial with ≥1 sent design → paid → month-3 retention.

## Pricing hypothesis (to test, not to publish)

Monthly per company, tiered by sent designs per month; setup includes loading the contractor's price book.
Validate willingness to pay in the first five demos before building billing.

## What v1 needs (engineering, gated)

- Tenant config: brand name, logo, colours, contact facts, price book and labour factors, behind one
  module (today these come from src/data/business.ts and the pricing constants).
- Embed mode for a contractor's site (iframe or script) and per-tenant lead routing (email first; the
  CRM already routes leads by tenant).
- Billing (e.g. Stripe): **needs the owner's explicit approval of the provider, the account and any
  spend.** Not started.

## Marketing baked-in checklist

- [ ] Owner go/no-go on this plan
- [ ] Landing page + demo brand (fictional) drafted
- [ ] Outreach list and first five message drafts (owner approves each)
- [ ] Contractor-focused article topics added to the blog queue (drafts)
- [ ] Tenant funnel events and monthly report defined
- [ ] Billing provider decision (owner)
