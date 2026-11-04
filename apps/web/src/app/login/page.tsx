'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UnnaSymbol } from '@/components/brand/UnnaSymbol';

const loginSchema = z.object({
  email: z.string().min(1, 'Email es obligatorio').email('Email inválido'),
  password: z.string().min(1, 'Contraseña es obligatoria'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Credenciales inválidas');
      }

      localStorage.setItem('auth_token', result.accessToken);
      localStorage.setItem('refresh_token', result.refreshToken);

      window.location.href = '/dashboard';
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 lg:py-20 flex items-center justify-center">
      <div className="container-custom">
        <div className="max-w-md mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-2 mb-8" aria-label="UNNA - Inicio">
              <UnnaSymbol className="w-10 h-10 text-unna-green" />
              <span className="text-2xl font-bold text-gray-900">UNNA</span>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Bienvenido de nuevo</h1>
            <p className="mt-3 text-gray-600">Ingresá a tu cuenta para continuar</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {submitError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{submitError}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="label-field">
                  Email <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <Input
                  {...register('email')}
                  id="email"
                  type="email"
                  placeholder="nombre@gmail.com"
                  error={errors.email?.message}
                  autoComplete="email"
                />
              </div>

              {/* Contraseña */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="label-field mb-0">
                    Contraseña <span className="text-red-500" aria-hidden="true">*</span>
                  </label>
                  <Link href="/recuperar-contrasena" className="text-sm text-unna-green hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <Input
                  {...register('password')}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  autoComplete="current-password"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isSubmitting}
              >
                Ingresar
              </Button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                ¿No tenés cuenta?{' '}
                <Link href="/crear-cuenta" className="text-unna-green font-medium hover:underline">
                  Crear una gratis
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}