/** Maps quote-form project types onto the booking scheduler's service list. */
const LEAD_TO_BOOKING: Record<string, string> = {
  'Interlocking patio': 'Interlocking Stone & Patios',
  'Interlock driveway': 'Interlocking Stone & Patios',
  'Patio repair or re-level': 'Interlocking Stone & Patios',
  'Composite deck': 'Composite Decking',
  'Retaining wall': 'Retaining Walls',
  'Landscape design': 'Landscape Design',
  'Outdoor kitchen': 'Other',
  'Seasonal clean-up': 'Other',
  'Not sure yet': 'Other',
};

export const BOOKING_SERVICE_OPTIONS = [
  'Complete Backyard Renovation',
  'Interlocking Stone & Patios',
  'Composite Decking',
  'Retaining Walls',
  'Landscape Design',
  'Pool Surround & Features',
  'Other',
] as const;

export function bookingServiceFromLead(service: string): string {
  if ((BOOKING_SERVICE_OPTIONS as readonly string[]).includes(service)) return service;
  return LEAD_TO_BOOKING[service] ?? BOOKING_SERVICE_OPTIONS[0];
}

/** Query string for /book/ so the thank-you page can pre-fill the scheduler. */
export function bookingSearch(input: {
  name?: string;
  phone?: string;
  email?: string;
  service?: string;
}): string {
  const params = new URLSearchParams();
  const name = input.name?.trim();
  const phone = input.phone?.trim();
  const email = input.email?.trim();
  const service = input.service?.trim();
  if (name) params.set('name', name);
  if (phone) params.set('phone', phone);
  if (email) params.set('email', email);
  if (service) params.set('service', service);
  const query = params.toString();
  return query ? `/book/?${query}` : '/book/';
}
