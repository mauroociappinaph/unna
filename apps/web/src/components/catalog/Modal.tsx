import type { ReactNode } from 'react';

export function Modal({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div role="dialog" aria-modal="true" className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
