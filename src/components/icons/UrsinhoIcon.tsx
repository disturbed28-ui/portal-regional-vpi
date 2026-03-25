import type { SVGProps } from 'react';

export const UrsinhoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Ears */}
    <circle cx="7" cy="6" r="2.5" />
    <circle cx="17" cy="6" r="2.5" />
    {/* Head */}
    <circle cx="12" cy="13" r="7" />
    {/* Eyes */}
    <circle cx="9.5" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="11.5" r="0.75" fill="currentColor" stroke="none" />
    {/* Snout */}
    <ellipse cx="12" cy="14.5" rx="2.5" ry="2" />
    {/* Nose */}
    <ellipse cx="12" cy="13.5" rx="1" ry="0.6" fill="currentColor" stroke="none" />
    {/* Mouth */}
    <path d="M12 14.1v1.2" />
  </svg>
);
