/** Class that globals.css keeps visible while printing; everything else is hidden. */
export const PRINT_TARGET_CLASS = 'print-target';

/** Prints only the element, e.g. the QR of a sucursal, with the browser print dialog. */
export function printElement(element: HTMLElement): void {
  element.classList.add(PRINT_TARGET_CLASS);
  try {
    window.print();
  } finally {
    element.classList.remove(PRINT_TARGET_CLASS);
  }
}
