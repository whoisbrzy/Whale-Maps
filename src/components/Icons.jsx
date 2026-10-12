/* The Whale Maps logo (public/logo.png) is a white silhouette on a transparent
   background. Rendering it as a CSS mask lets it take any text color. */
export function WhaleMark({ className = "", ...rest }) {
  return <span className={`whale-mark ${className}`} role="img" aria-hidden="true" {...rest} />;
}

export function ArrowRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ArrowUp(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

export function Menu(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function Discord(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.4c1.7.4 2.5 1 3.4 1.7a14.6 14.6 0 0 0-13.2 0c.9-.7 1.9-1.4 3.6-1.7L8.8 3a19.8 19.8 0 0 0-4.9 1.4C.8 9 0 13.4.4 17.7a19.9 19.9 0 0 0 6 3l1.3-2.1c-.7-.3-1.4-.6-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5-.8-9.3-3.9-13.3ZM8.3 15c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm7.4 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}
