// src/app/AdultBadge.js : the "18+" tag (glossy red seal). size: xs | sm | md | lg
export default function AdultBadge({ size = "md", className = "" }) {
  const sizes = {
    xs: "text-[9px] px-1.5 py-[3px] rounded",
    sm: "text-[11px] px-2 py-1 rounded-md",
    md: "text-xs px-2.5 py-1.5 rounded-lg",
    lg: "text-sm px-3 py-1.5 rounded-xl",
  };
  return (
    <span
      title="Adults only (18+)"
      aria-label="Adults only, 18 plus"
      className={`relative inline-flex items-center justify-center overflow-hidden font-black leading-none tracking-tight text-white select-none bg-gradient-to-br from-red-500 via-red-600 to-red-800 ring-1 ring-white/50 shadow-lg shadow-red-600/50 ${sizes[size] || sizes.md} ${className}`}
    >
      <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/35 to-transparent" aria-hidden="true" />
      <span className="relative drop-shadow">
        18<span className="text-yellow-200">+</span>
      </span>
    </span>
  );
}
