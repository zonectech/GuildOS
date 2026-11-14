/** Field markers used on every form: a red asterisk for required (screen readers hear "required"), and "(optional)". */
export const Req = () => <><span aria-hidden className="ml-0.5 text-coral-text">*</span><span className="sr-only"> (required)</span></>;
export const Opt = () => <span className="ml-1 font-normal text-muted">(optional)</span>;
/** The line at the top of a form that explains the asterisk. */
export const RequiredNote = ({ className = '' }: { className?: string }) => <p className={`text-[13px] text-muted ${className}`}><span aria-hidden className="text-coral-text">*</span> Required</p>;
