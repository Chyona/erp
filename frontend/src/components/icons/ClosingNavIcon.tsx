type ClosingNavIconProps = {
  filled?: boolean;
};

export default function ClosingNavIcon({ filled = false }: ClosingNavIconProps) {
  const svgProps = {
    className: 'closing-nav-icon',
    viewBox: '5 2 17 19' as const,
    width: '1.12em' as const,
    height: '1.12em' as const,
    'aria-hidden': true as const,
    focusable: 'false' as const
  };

  if (filled) {
    return (
      <svg {...svgProps} fill="currentColor">
        <path d="M7 4h8.2L19 7.8V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
        <path
          d="M15 4v4h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          opacity="0.35"
        />
        <rect x="8" y="9.5" width="6.5" height="1.4" rx="0.7" fill="#fff" opacity="0.92" />
        <rect x="8" y="12.3" width="4.5" height="1.4" rx="0.7" fill="#fff" opacity="0.92" />
        <path
          d="M12.8 16.2 15.1 18.5 19.6 14"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      {...svgProps}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4h8.2L19 7.8V18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M15 4v4h4" />
      <path d="M8.5 10h6.5" />
      <path d="M8.5 12.8h4.5" />
      <path d="M12.8 16.2 15.1 18.5 19.6 14" />
    </svg>
  );
}
