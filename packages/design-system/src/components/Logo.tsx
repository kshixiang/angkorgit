export function Logo({
  size = 32,
  className,
  animated = false,
}: {
  size?: number;
  className?: string;
  animated?: boolean | 'loop';
}) {
  const loop = animated === 'loop';
  const draw = animated
    ? {
        strokeDasharray: 300,
        strokeDashoffset: 300,
        animation: loop
          ? 'gitmd-draw-loop 2.6s cubic-bezier(0.6, 0, 0.2, 1) infinite'
          : 'gitmd-draw 1.6s cubic-bezier(0.6, 0, 0.2, 1) forwards',
      }
    : undefined;
  const dots = loop ? { animation: 'gitmd-dots-loop 2.6s ease-in-out infinite' } : undefined;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="GitMD"
    >
      {animated && (
        <style>{`@keyframes gitmd-draw { to { stroke-dashoffset: 0; } }
@keyframes gitmd-draw-loop { 0% { stroke-dashoffset: 300; opacity: 1; } 55% { stroke-dashoffset: 0; opacity: 1; } 82% { stroke-dashoffset: 0; opacity: 1; } 100% { stroke-dashoffset: 0; opacity: 0; } }
@keyframes gitmd-dots-loop { 0%, 40% { opacity: 0; } 60%, 82% { opacity: 1; } 100% { opacity: 0; } }`}</style>
      )}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" style={draw}>
        <path d="M23.2 9.5V54.5" stroke="#3FB950" strokeWidth={5.4} />
        <path d="M23.2 23.9C50.2 23.9 50.2 41.9 23.2 41.9" stroke="#58A6FF" strokeWidth={5.4} />
      </g>
      <circle cx={23.2} cy={9.5} r={5.4} fill="#7EE787" style={dots} />
      <circle cx={23.2} cy={23.9} r={5.4} fill="#7EE787" style={dots} />
      <circle cx={23.2} cy={41.9} r={5.4} fill="#7EE787" style={dots} />
      <circle cx={23.2} cy={54.5} r={5.4} fill="#7EE787" style={dots} />
    </svg>
  );
}
