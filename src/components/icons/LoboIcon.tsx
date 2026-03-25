import type { SVGProps } from 'react';

export const LoboIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Head outline */}
    <path d="M12 20c-4.5 0-7-3-7-6.5V11l-2-7 4.5 3h9L21 4l-2 7v2.5c0 3.5-2.5 6.5-7 6.5z" />
    {/* Left pointed ear */}
    <path d="M3 4l4.5 3" />
    {/* Right pointed ear */}
    <path d="M21 4l-4.5 3" />
    {/* Eyes */}
    <circle cx="9" cy="11.5" r="1" fill="currentColor" stroke="none" />
    <circle cx="15" cy="11.5" r="1" fill="currentColor" stroke="none" />
    {/* Snout */}
    <path d="M9.5 15.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5" />
    {/* Nose */}
    <ellipse cx="12" cy="14" rx="1.3" ry="0.9" fill="currentColor" stroke="none" />
    {/* Mouth line */}
    <path d="M12 14.9v1.5" />
  </svg>
);
