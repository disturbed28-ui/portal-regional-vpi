import type { SVGProps } from 'react';

export const UrsinhoIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Left ear */}
    <circle cx="7.5" cy="5.5" r="3" />
    <circle cx="7.5" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
    {/* Right ear */}
    <circle cx="16.5" cy="5.5" r="3" />
    <circle cx="16.5" cy="5.5" r="1.2" fill="currentColor" stroke="none" />
    {/* Head */}
    <circle cx="12" cy="13.5" r="7.5" />
    {/* Eyes */}
    <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    {/* Muzzle oval */}
    <ellipse cx="12" cy="15.5" rx="3" ry="2.2" />
    {/* Nose */}
    <ellipse cx="12" cy="14.5" rx="1.2" ry="0.8" fill="currentColor" stroke="none" />
    {/* Mouth */}
    <path d="M10.5 16.5c.7.7 2.3.7 3 0" />
  </svg>
);
