// CuraphiMark — the brand mark used in the top nav and the favicon. A stem
// curving like a vine with seven olive-leaf fronds along it, plus five olive
// berries tucked between the fronds. Colors are exposed as props so the same
// component can render in brand teal (on light surfaces), white (on the dark
// variant), or any custom palette in special contexts. The olives default to
// the brand gold.
//
// Use `title=""` (empty string) anywhere the mark sits directly beside the
// "Curaphi" wordmark — that hides the redundant hover tooltip when the brand
// name is already visible right next to it.

export interface CuraphiMarkProps {
  className?: string;
  /** Stem + leaf color. Defaults to brand teal #2A6B5E. */
  color?: string;
  /** Olive berry color. Defaults to brand gold #B98A2E. */
  oliveColor?: string;
  /** Hover tooltip text. Pass "" to suppress the tooltip when the wordmark is adjacent. */
  title?: string;
}

export function CuraphiMark({
  className,
  color = "#2A6B5E",
  oliveColor = "#B98A2E",
  title,
}: CuraphiMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 100"
      className={className}
      role="img"
      aria-label="Curaphi"
    >
      {title !== undefined && <title>{title}</title>}
      <path
        d="M30,93 C21,74 41,46 30,19"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g fill={color}>
        <path transform="translate(27,74) rotate(-42) scale(0.8)" d="M0,0 Q8.5,-11 0,-22 Q-8.5,-11 0,0 Z" />
        <path transform="translate(34,74) rotate(42) scale(0.8)" d="M0,0 Q8.5,-11 0,-22 Q-8.5,-11 0,0 Z" />
        <path transform="translate(30,49) rotate(-42) scale(0.8)" d="M0,0 Q8.5,-11 0,-22 Q-8.5,-11 0,0 Z" />
        <path transform="translate(37,49) rotate(42) scale(0.8)" d="M0,0 Q8.5,-11 0,-22 Q-8.5,-11 0,0 Z" />
        <path transform="translate(27,29) rotate(-38) scale(0.8)" d="M0,0 Q8.5,-11 0,-22 Q-8.5,-11 0,0 Z" />
        <path transform="translate(33,29) rotate(38) scale(0.8)" d="M0,0 Q8.5,-11 0,-22 Q-8.5,-11 0,0 Z" />
        <path transform="translate(30,21) rotate(0) scale(0.8)" d="M0,0 Q8.5,-11 0,-22 Q-8.5,-11 0,0 Z" />
      </g>
      <g fill={oliveColor}>
        <ellipse cx="0" cy="0" rx="3.4" ry="4.8" transform="translate(23,77) scale(0.9)" />
        <ellipse cx="0" cy="0" rx="3.4" ry="4.8" transform="translate(39,72) scale(0.9)" />
        <ellipse cx="0" cy="0" rx="3.4" ry="4.8" transform="translate(23,52) scale(0.9)" />
        <ellipse cx="0" cy="0" rx="3.4" ry="4.8" transform="translate(40,53) scale(0.9)" />
        <ellipse cx="0" cy="0" rx="3.4" ry="4.8" transform="translate(31,32) scale(0.9)" />
      </g>
    </svg>
  );
}
