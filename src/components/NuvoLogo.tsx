interface LogoProps {
  className?: string;
  size?: number;
}

export function NuvoLogo({ className = '', size = 40 }: LogoProps) {
  const gid = 'nuvora-grad-' + size;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="NUVORA logo"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00D4A8" />
          <stop offset="0.5" stopColor="#00B8D4" />
          <stop offset="1" stopColor="#0099E5" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${gid})`} />
      <path
        d="M14 33V15.5C14 14.9 14.5 14.5 15 14.8L32 25.3C32.5 25.6 32.5 26.4 32 26.7L15 37.2C14.5 37.5 14 37.1 14 36.5V33"
        stroke="white"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.95"
      />
      <circle cx="33.5" cy="14.5" r="3.5" fill="white" />
    </svg>
  );
}

export function NuvoMark({ className = '', size = 40 }: LogoProps) {
  const gid = 'nuvora-mark-' + size;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00D4A8" />
          <stop offset="1" stopColor="#0099E5" />
        </linearGradient>
      </defs>
      <path
        d="M14 33V15.5C14 14.9 14.5 14.5 15 14.8L32 25.3C32.5 25.6 32.5 26.4 32 26.7L15 37.2C14.5 37.5 14 37.1 14 36.5V33"
        stroke={`url(#${gid})`}
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33.5" cy="14.5" r="3.5" fill={`url(#${gid})`} />
    </svg>
  );
}
