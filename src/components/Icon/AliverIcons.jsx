const baseProps = (size, strokeWidth) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round",
  strokeLinejoin: "round"
});

export function NextIcon({ size = 24, color = "#16a34a", strokeWidth = 1.75, className }) {
  return (
    <svg {...baseProps(size, strokeWidth)} stroke={color} className={className}>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function PreviousIcon({ size = 24, color = "#16a34a", strokeWidth = 1.75, className }) {
  return (
    <svg {...baseProps(size, strokeWidth)} stroke={color} className={className}>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

export function SubmitIcon({ size = 24, color = "#16a34a", strokeWidth = 1.75, className }) {
  return (
    <svg {...baseProps(size, strokeWidth)} stroke={color} className={className}>
      <path d="M6.5 6.5a4 4 0 0 1 5.66 0l5.34 5.34a4 4 0 1 1-5.66 5.66L6.5 12.16a4 4 0 0 1 0-5.66Z" />
      <path d="M9 9l6 6" />
      <path d="M16.5 15.5l1.25 1.25L20.5 14" />
    </svg>
  );
}

export function SearchIcon({ size = 24, color = "#16a34a", strokeWidth = 1.75, className }) {
  return (
    <svg {...baseProps(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function ThemeIcon({ size = 24, color = "#16a34a", strokeWidth = 1.75, className }) {
  return (
    <svg {...baseProps(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="12" cy="12" r="4.25" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}

export function AuthIcon({ size = 24, color = "#16a34a", strokeWidth = 1.75, className }) {
  return (
    <svg {...baseProps(size, strokeWidth)} stroke={color} className={className}>
      <circle cx="10.5" cy="8.5" r="3.5" />
      <path d="M3.5 20c0-3.87 3.13-6.5 7-6.5" />
      <circle cx="18" cy="6" r="1.4" />
      <circle cx="20.5" cy="9.5" r="1.1" />
      <circle cx="16.5" cy="10" r="1.1" />
      <path d="M18 6l2.5 3.5M18 6l-1.5 4" />
    </svg>
  );
}
