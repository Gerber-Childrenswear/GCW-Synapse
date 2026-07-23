type Props = {
  /** full = raster brand + fire overlays; mark = compact animated SVG */
  variant?: "full" | "mark";
  className?: string;
  title?: string;
};

/**
 * Synapse brand hero — logo asset with layered “synapses firing” motion
 * (pixel flicker, hub pulse/flare, traveling sparks, output node glow).
 */
export function SynapseLogo({ variant = "full", className = "", title = "SYNAPSE" }: Props) {
  if (variant === "mark") {
    return <SynapseMarkSvg className={className} title={title} />;
  }

  return (
    <div className={`synapse-logo-hero ${className}`.trim()} role="img" aria-label={title}>
      <img className="synapse-logo-img" src="/synapse-logo.png" alt="" draggable={false} />
      <div className="synapse-fire" aria-hidden="true">
        <span className="fire-pixels" />
        <span className="fire-hub" />
        <span className="fire-flare" />
        <span className="fire-spark spark-a" />
        <span className="fire-spark spark-b" />
        <span className="fire-spark spark-c" />
        <span className="fire-node node-a" />
        <span className="fire-node node-b" />
        <span className="fire-node node-c" />
        <span className="fire-wordglow" />
      </div>
    </div>
  );
}

function SynapseMarkSvg({ className = "", title }: { className?: string; title: string }) {
  return (
    <svg
      className={`synapse-logo synapse-logo-mark ${className}`.trim()}
      viewBox="0 0 280 220"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="synTraceM" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#3dd6ff" />
          <stop offset="45%" stopColor="#7b6cff" />
          <stop offset="100%" stopColor="#c44dff" />
        </linearGradient>
        <linearGradient id="synPixelM" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5ee7ff" />
          <stop offset="100%" stopColor="#4f7dff" />
        </linearGradient>
        <radialGradient id="synHubCoreM" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#e8d6ff" />
          <stop offset="70%" stopColor="#b14bff" />
          <stop offset="100%" stopColor="#7b2cff" stopOpacity="0" />
        </radialGradient>
        <filter id="synGlowM" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="synFlareM" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g className="synapse-icon" transform="translate(8, 18)">
        <g className="synapse-pixels" fill="url(#synPixelM)">
          <rect className="px p1" x="8" y="48" width="10" height="10" rx="1.5" />
          <rect className="px p2" x="22" y="40" width="9" height="9" rx="1.5" />
          <rect className="px p3" x="20" y="56" width="11" height="11" rx="1.5" />
          <rect className="px p4" x="36" y="34" width="8" height="8" rx="1.5" />
          <rect className="px p5" x="34" y="50" width="10" height="10" rx="1.5" />
          <rect className="px p6" x="36" y="68" width="9" height="9" rx="1.5" />
          <rect className="px p7" x="48" y="44" width="8" height="8" rx="1.5" />
          <rect className="px p8" x="50" y="60" width="10" height="10" rx="1.5" />
          <rect className="px p9" x="14" y="72" width="8" height="8" rx="1.5" />
          <rect className="px p10" x="6" y="64" width="7" height="7" rx="1.5" />
          <rect className="px p11" x="52" y="30" width="7" height="7" rx="1.5" />
          <rect className="px p12" x="44" y="78" width="8" height="8" rx="1.5" />
        </g>

        <g
          className="synapse-traces"
          fill="none"
          stroke="url(#synTraceM)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path className="trace t1" d="M58 48 H92 Q108 48 108 64 V88" />
          <path className="trace t2" d="M60 58 H100 Q112 58 112 74 V92" />
          <path className="trace t3" d="M58 70 H96 Q110 70 110 82 V96" />
          <path className="trace t4" d="M56 82 H90 Q106 82 106 94 V100" />
        </g>

        <g className="synapse-sparks" filter="url(#synGlowM)">
          <circle className="spark s1" r="3.5" fill="#ffffff">
            <animateMotion dur="1.8s" repeatCount="indefinite" path="M58 48 H92 Q108 48 108 64 V100" />
          </circle>
          <circle className="spark s2" r="3" fill="#c9b6ff">
            <animateMotion dur="2.2s" begin="0.35s" repeatCount="indefinite" path="M60 58 H100 Q112 58 112 74 V100" />
          </circle>
          <circle className="spark s3" r="2.8" fill="#7ef0ff">
            <animateMotion dur="1.95s" begin="0.7s" repeatCount="indefinite" path="M58 70 H96 Q110 70 110 82 V100" />
          </circle>
        </g>

        <g className="synapse-hub" transform="translate(110, 108)" filter="url(#synFlareM)">
          <circle className="hub-bloom" r="28" fill="url(#synHubCoreM)" opacity="0.85" />
          <circle className="hub-core" r="10" fill="#ffffff" />
          <line className="hub-streak" x1="-36" y1="0" x2="36" y2="0" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
        </g>

        <g
          className="synapse-out-traces"
          fill="none"
          stroke="url(#synTraceM)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M128 100 H168 Q184 100 184 78 V58" />
          <path d="M132 108 H176" strokeDasharray="6 7" />
          <path d="M128 116 H168 Q184 116 184 136 V152" />
        </g>

        <g className="synapse-nodes" filter="url(#synGlowM)">
          <rect className="node n1" x="176" y="46" width="28" height="18" rx="5" fill="url(#synTraceM)" />
          <rect className="node n2" x="176" y="98" width="28" height="18" rx="5" fill="url(#synTraceM)" />
          <rect className="node n3" x="176" y="144" width="28" height="18" rx="5" fill="url(#synTraceM)" />
        </g>
      </g>
    </svg>
  );
}
