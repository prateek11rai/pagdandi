// An inline script that runs once from the server HTML. React warns about <script> tags it renders
// on the client, so the client copy is inert (text/plain); see Next's "preventing flash" guide.
export function InlineScript({ html, nonce }: { html: string; nonce?: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
