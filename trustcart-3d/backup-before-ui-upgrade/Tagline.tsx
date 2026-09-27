interface TaglineProps {
  children?: React.ReactNode;
}

export default function Tagline({
  children = "Compare prices. Trust every deal.",
}: TaglineProps) {
  return <>{children}</>;
}
