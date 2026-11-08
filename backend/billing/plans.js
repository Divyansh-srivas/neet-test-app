// Single source of truth for paid plans. Prices are in PAISE (₹1 = 100 paise).
// The server always charges from this table; the client only ever sends a plan id.
export const PLANS = [
  { id: 'm1',     name: '1 Month',     priceInr: 499,  extractions: 7,  validDays: 30,  tagline: 'Try it for a month' },
  { id: 'm3',     name: '3 Months',    priceInr: 1599,  extractions: 24, validDays: 90,  tagline: 'Steady prep for a term', badge: 'Popular' },
  { id: 'm6',     name: '6 Months',    priceInr: 2599, extractions: 45, validDays: 180, tagline: 'Half-year prep' },
  { id: 'neet27', name: 'NEET 2027 Special', priceInr: 2799, extractions: 50, validDays: 210, tagline: 'Valid 7 months, till NEET 2027', badge: 'NEET Special' },
];

export const getPlan = (id) => PLANS.find((p) => p.id === id) || null;
export const toPaise = (inr) => Math.round(inr * 100);

export const publicPlans = () =>
  PLANS.map((p) => ({ ...p, amountPaise: toPaise(p.priceInr), perExtractionInr: Math.round(p.priceInr / p.extractions) }));

// Pure helpers (unit-tested) ---------------------------------------------------
export const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86400000);

// A pack is usable only when paid, not expired and has credits left.
export const packRemaining = (pack, now = new Date()) => {
  if (!pack || pack.status !== 'paid') return 0;
  if (!pack.expires_at || new Date(pack.expires_at) <= now) return 0;
  return Math.max(0, (pack.credits_total || 0) - (pack.credits_used || 0));
};

export const summarizePacks = (packs, now = new Date()) => {
  const usable = (packs || []).filter((p) => packRemaining(p, now) > 0);
  const remaining = usable.reduce((s, p) => s + packRemaining(p, now), 0);
  const nextExpiry = usable.length
    ? usable.map((p) => new Date(p.expires_at)).sort((a, b) => a - b)[0].toISOString()
    : null;
  // planActive: any paid, unexpired plan, even if every extraction credit is used up (drives Library access)
  const planActive = (packs || []).some((p) => p && p.status === 'paid' && p.expires_at && new Date(p.expires_at) > now);
  return { remaining, nextExpiry, activePacks: usable.length, planActive };
};
