type Props = { text: string; onDismiss: () => void };

/** One-line, dismissable, first-time contextual hint (spec §6.3). */
export const Hint = ({ text, onDismiss }: Props) => (
  <div className="hint fade-in" role="note">
    <span className="hint-icon" aria-hidden="true">
      ✎
    </span>
    <span className="hint-text">{text}</span>
    <button type="button" className="btn btn-small btn-ghost hint-btn" onClick={onDismiss}>
      Got it
    </button>
  </div>
);
