import type { SVGProps } from 'react';

export const LoboIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    {/* Wolf head silhouette */}
    <path d="M4 4l3 6v3c0 1 .5 2 1.5 2.5L12 17l3.5-1.5c1-.5 1.5-1.5 1.5-2.5v-3l3-6" />
    <path d="M7 10c0 0-1.5-.5-2.5.5" />
    <path d="M17 10c0 0 1.5-.5 2.5.5" />
    {/* Eyes */}
    <circle cx="9.5" cy="11" r="0.75" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="11" r="0.75" fill="currentColor" stroke="none" />
    {/* Nose */}
    <path d="M11 14h2l-1 1.5z" fill="currentColor" stroke="none" />
    {/* Ears */}
    <path d="M4 4c.5 2 1.5 3 3 3" />
    <path d="M20 4c-.5 2-1.5 3-3 3" />
  </svg>
);
