/** Renderer sender validation shared by every named main-process handler. */
export function isTrustedIpcSender(sender: unknown, mainWebContents: unknown): boolean {
  return sender === mainWebContents;
}
