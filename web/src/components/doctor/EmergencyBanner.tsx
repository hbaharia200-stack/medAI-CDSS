
interface EmergencyBannerProps {
  text: string;
  /** Names of the patients carrying the emergency flag, so the doctor knows who to see first. */
  names?: string[];
}

/**
 * Fixed red banner above everything (queue, summary, AI panel) whenever any
 * case carries an emergency flag from the rule-based guardrails. Structurally
 * separate from the ranked AI list.
 */
export function EmergencyBanner({ text, names }: EmergencyBannerProps) {
  return (
    <div
      role="alert"
      className="sticky top-0 z-20 bg-danger px-4 py-3 text-white shadow-md"
    >
      <div className="flex items-center justify-center gap-3">
        <span aria-hidden className="text-xl">🚨</span>
        <p className="text-base font-extrabold sm:text-lg">{text}</p>
      </div>
      {names && names.length > 0 ? (
        <p className="mt-1 text-center text-sm font-extrabold opacity-95">
          {names.join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

export default EmergencyBanner;