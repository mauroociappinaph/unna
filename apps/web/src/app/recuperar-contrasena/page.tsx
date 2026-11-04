'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';
import { ForgotPasswordForm, ResetPasswordForm } from '@/components/auth/PasswordRecoveryForms';

/** Public page of the emailed reset link: asks for the email, or with ?token= for the new password. */
function RecuperarContrasenaContent() {
  const token = useSearchParams().get('token');

  return (
    <div className="min-h-screen bg-gray-50 py-12 lg:py-20 flex items-center justify-center">
      <div className="container-custom">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-2 mb-8" aria-label="UNNA - Inicio">
              <UnnaSymbol className="w-10 h-10 text-unna-green" />
              <span className="text-2xl font-bold text-gray-900">UNNA</span>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">{token ? 'Elegí una nueva contraseña' : 'Recuperá tu contraseña'}</h1>
            <p className="mt-3 text-gray-600">
              {token ? 'Ingresala dos veces para confirmarla.' : 'Ingresá tu email y te mandamos un link para restablecerla.'}
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {token ? <ResetPasswordForm token={token} /> : <ForgotPasswordForm />}

            <div className="mt-8 text-center">
              <Link href="/login" className="text-sm text-unna-green-dark font-medium hover:underline">
                Volver a iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary so the page can be prerendered.
export default function RecuperarContrasenaPage() {
  return (
    <Suspense fallback={null}>
      <RecuperarContrasenaContent />
    </Suspense>
  );
}
