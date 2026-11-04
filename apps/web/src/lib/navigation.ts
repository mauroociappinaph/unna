/** Full-page navigation to another site, e.g. the Mercado Pago authorization page. */
export function redirectTo(url: string): void {
  window.location.assign(url);
}
