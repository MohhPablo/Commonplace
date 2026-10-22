export function InlineError({ children }: { children?: React.ReactNode }) {
  return children ? (
    <p
      role="alert"
      className="my-3 rounded-xl border border-rust/30 bg-surface px-4 py-3 text-sm text-rust"
    >
      {children}
    </p>
  ) : null;
}
