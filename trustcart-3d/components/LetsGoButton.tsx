interface LetsGoButtonProps {
  scanning?: boolean;
  hovered?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function LetsGoButton({
  scanning = false,
  hovered = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: LetsGoButtonProps) {
  return (
    <button
      type="button"
      className={`lets-go-button ${
        hovered ? "lets-go-hovered" : ""
      } ${scanning ? "lets-go-scanning" : ""}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={scanning}
      aria-label={
        scanning ? "Opening TrustCart" : "Enter TrustCart"
      }
    >
      <span className="button-text">
        {scanning ? "Opening..." : "Let’s go"}
      </span>

      {!scanning && (
        <span className="button-arrow" aria-hidden="true">
          →
        </span>
      )}

      <span className="button-shine" />
    </button>
  );
}
