interface LetsGoButtonProps {
  scanning?: boolean;
  onClick?: () => void;
}

export default function LetsGoButton({
  scanning = false,
  onClick,
}: LetsGoButtonProps) {
  return (
    <button
      className="lets-go-button"
      onClick={onClick}
      disabled={scanning}
    >
      <span>{scanning ? "Scanning..." : "Let’s go"}</span>

      {!scanning && <span className="button-arrow">→</span>}
    </button>
  );
}
