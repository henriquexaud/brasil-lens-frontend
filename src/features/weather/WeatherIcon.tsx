import type { SVGProps } from 'react';

interface WeatherIconProps extends SVGProps<SVGSVGElement> {
  code: number | null;
  size?: number;
}

export function WeatherIcon({ code, size = 16, className = '', ...props }: WeatherIconProps) {
  const c = code ?? -1;

  // Céu limpo (0)
  if (c === 0) {
    return (
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={`weather-svg-icon is-sun ${className}`}
        aria-hidden="true"
        {...props}
      >
        <circle cx="10" cy="10" r="3.5" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" />
        <path
          d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"
          stroke="#d97706"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Predominantemente / Parcialmente nublado (1, 2)
  if (c === 1 || c === 2) {
    return (
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={`weather-svg-icon is-partly-cloudy ${className}`}
        aria-hidden="true"
        {...props}
      >
        <circle cx="7.5" cy="7.5" r="3" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" />
        <path
          d="M7.5 2.5v1.5M3.5 5.5l1.2.9M2.5 8.5h1.5M11.5 5l.9-1.2"
          stroke="#d97706"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
        <path
          d="M6 16h8a3 3 0 0 0 .5-5.96 4 4 0 0 0-7.5-1.54A3 3 0 0 0 6 16z"
          fill="#cbd5e1"
          stroke="#64748b"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Nublado (3)
  if (c === 3) {
    return (
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={`weather-svg-icon is-cloudy ${className}`}
        aria-hidden="true"
        {...props}
      >
        <path
          d="M5.5 11.5h-.3a3 3 0 0 1-.2-6 3.5 3.5 0 0 1 6.5-1.5 3 3 0 0 1 3.5 3.5"
          stroke="#94a3b8"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d="M6 16h8a3 3 0 0 0 .5-5.96 4 4 0 0 0-7.5-1.54A3 3 0 0 0 6 16z"
          fill="#cbd5e1"
          stroke="#64748b"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Nevoeiro (45, 48)
  if (c === 45 || c === 48) {
    return (
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={`weather-svg-icon is-fog ${className}`}
        aria-hidden="true"
        {...props}
      >
        <path
          d="M4.5 6.5h11M3 10h14M4.5 13.5h11M6 17h8"
          stroke="#64748b"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Chuva / Garoa / Pancadas (51-67, 80-82)
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(c)) {
    return (
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={`weather-svg-icon is-rain ${className}`}
        aria-hidden="true"
        {...props}
      >
        <path
          d="M5.5 11h9a2.8 2.8 0 0 0 .5-5.5 3.5 3.5 0 0 0-6.8-1.2A2.8 2.8 0 0 0 5.5 11z"
          fill="#cbd5e1"
          stroke="#64748b"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M7 13.5l-1 3M10.5 13.5l-1 3M14 13.5l-1 3"
          stroke="#0284c7"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  // Neve (71-77, 85, 86)
  if ([71, 73, 75, 77, 85, 86].includes(c)) {
    return (
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={`weather-svg-icon is-snow ${className}`}
        aria-hidden="true"
        {...props}
      >
        <path
          d="M10 2.5v15M3.5 10h13M5.5 5.5l9 9M5.5 14.5l9-9M8 4l2-1.5L12 4M8 16l2 1.5L12 16M4 8l-1.5 2L4 12M16 8l1.5 2-1.5 2"
          stroke="#0284c7"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Trovoadas (95, 96, 99)
  if ([95, 96, 99].includes(c)) {
    return (
      <svg
        viewBox="0 0 20 20"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        className={`weather-svg-icon is-thunder ${className}`}
        aria-hidden="true"
        {...props}
      >
        <path
          d="M5 10.5h10a2.8 2.8 0 0 0 .5-5.5 3.5 3.5 0 0 0-6.8-1.2A2.8 2.8 0 0 0 5 10.5z"
          fill="#94a3b8"
          stroke="#475569"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M10.5 10.5L8.5 14h2.5l-1 4.5 4.2-5.5h-2.5l1.3-2.5h-2.5z"
          fill="#eab308"
          stroke="#ca8a04"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // Fallback (temperatura / clima geral)
  return (
    <svg
      viewBox="0 0 20 20"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      className={`weather-svg-icon is-default ${className}`}
      aria-hidden="true"
      {...props}
    >
      <circle cx="10" cy="10" r="4" fill="#f59e0b" stroke="#d97706" strokeWidth="1.2" />
      <path
        d="M10 3v2M10 15v2M3 10h2M15 10h2"
        stroke="#d97706"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
