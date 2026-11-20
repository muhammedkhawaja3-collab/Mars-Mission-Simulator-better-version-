/** Small side-view rocket icon (decorative). Colour comes from currentColor. */
export default function RocketGlyph({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 20" aria-hidden="true" focusable="false">
      <path d="M6 4h26l10 6-10 6H6z" fill="currentColor" />
      <path d="M6 4 0 0v8zM6 16l-6 4v-8z" fill="currentColor" opacity="0.6" />
      <circle cx="22" cy="10" r="3.5" className="rocket-glyph__window" />
    </svg>
  );
}
