import LeadForm from './LeadForm';
import { publicContact } from '../data/business';

/** Shared quick-quote. Phone stays on publicContact so the number is not hardcoded. */
export default function QuickQuote({
  source = 'quick-quote',
  defaultService = '',
}: {
  source?: string;
  defaultService?: string;
}) {
  return (
    <div className="bg-brand-surface border border-brand-dim/40 rounded-[2px] p-5 md:p-8 min-w-0">
      <LeadForm
        formName="quick-quote"
        source={source}
        idPrefix="quick-quote"
        submitLabel="Send my quick quote"
        heading="Quick quote"
        intro={`Prefer to talk? Call ${publicContact.phoneDisplay}.`}
        defaultService={defaultService}
      />
    </div>
  );
}
