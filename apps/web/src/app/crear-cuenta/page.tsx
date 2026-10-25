'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { registerRequestSchema, type RegisterRequest } from '@unna/shared';

const phoneRegex = /^(\+?54)?9?\d{2}\d{4}\d{4}$/;

function formatPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6, 10)}`;
}

function parsePhone(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    mode: 'onBlur',
    defaultValues: {
      businessName: '',
      name: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
      acceptTerms: false,
    },
  });

  const phoneValue = watch('phone');

  const onSubmit = async (data: RegisterRequest) => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: data.businessName,
          name: data.name,
          phone: parsePhone(data.phone),
          email: data.email,
          password: data.password,
          confirmPassword: data.confirmPassword,
          acceptTerms: data.acceptTerms,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al crear la cuenta');
      }

      setSubmitSuccess(true);
      localStorage.setItem('auth_token', result.accessToken);
      localStorage.setItem('refresh_token', result.refreshToken);

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setValue('phone', formatted, { shouldValidate: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 lg:py-20">
      <div className="container-custom">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <Link href="/" className="inline-flex items-center gap-2 mb-8" aria-label="UNNA - Inicio">
              <svg className="w-10 h-10 text-unna-green" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5L25.5 9 16 13.5 6.5 9 16 4.5zM6 10.5l9 4.5 9-4.5v11L16 28.5 6 24v-13.5z" />
              </svg>
              <span className="text-2xl font-bold text-gray-900">UNNA</span>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">¡Crea tu cuenta gratis!</h1>
            <p className="mt-3 text-gray-600">Comenzá a gestionar tu restaurante en 15 minutos.</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            {submitSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800" role="alert">
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>¡Cuenta creada exitosamente! Redirigiendo...</span>
                </div>
              </div>
            )}

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
              {/* Nombre del negocio */}
              <div>
                <label htmlFor="businessName" className="label-field">
                  Nombre del negocio <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <Input
                  {...register('businessName')}
                  id="businessName"
                  type="text"
                  placeholder="Ej: Mi Restaurante"
                  error={errors.businessName?.message}
                  maxLength={45}
                  autoComplete="organization"
                />
              </div>

              {/* Tu nombre */}
              <div>
                <label htmlFor="name" className="label-field">
                  Tu nombre <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <Input
                  {...register('name')}
                  id="name"
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  error={errors.name?.message}
                  maxLength={45}
                  autoComplete="name"
                />
              </div>

              {/* Teléfono */}
              <div>
                <label htmlFor="phone" className="label-field">
                  Teléfono <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <Input
                  {...register('phone')}
                  id="phone"
                  type="tel"
                  placeholder="11 1234 5678"
                  value={phoneValue}
                  onChange={handlePhoneChange}
                  error={errors.phone?.message}
                  maxLength={20}
                  autoComplete="tel"
                  inputMode="tel"
                />
                <p className="mt-1.5 text-sm text-gray-500">Ejemplo: 11 1234 5678</p>
              </div>

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
                <label htmlFor="password" className="label-field">
                  Contraseña <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <Input
                  {...register('password')}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  error={errors.password?.message}
                  autoComplete="new-password"
                />
                <p className="mt-1.5 text-sm text-gray-500">
                  Mínimo 8 caracteres, una mayúscula, una minúscula y un número.
                </p>
              </div>

              {/* Confirmar contraseña */}
              <div>
                <label htmlFor="confirmPassword" className="label-field">
                  Confirmar contraseña <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <Input
                  {...register('confirmPassword')}
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  error={errors.confirmPassword?.message}
                  autoComplete="new-password"
                />
              </div>

              {/* Términos y condiciones */}
              <div>
                <Checkbox
                  {...register('acceptTerms')}
                  id="acceptTerms"
                  label="Acepto las Condiciones y Políticas de UNNA"
                  description={
                    <span className="text-unna-green hover:underline cursor-pointer">
                      Leer términos
                    </span>
                  }
                  error={errors.acceptTerms?.message}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                loading={isSubmitting}
                disabled={isSubmitting}
              >
                Crear mi cuenta gratis
              </Button>

              <p className="text-center text-sm text-gray-600">
                <svg className="w-4 h-4 inline-block mr-1 text-unna-green" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Sin tarjeta de crédito. Cancelá cuando quieras.
              </p>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-gray-600">
                ¿Ya tenés cuenta?{' '}
                <Link href="/login" className="text-unna-green font-medium hover:underline">
                  Ingresar
                </Link>
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="mt-10 grid grid-cols-3 gap-6 text-center">
            {[
              { icon: 'credit-card', text: 'Sin tarjeta de crédito' },
              { icon: 'clock', text: 'Listo en 15 min' },
              { icon: 'shield', text: 'Cancelá cuando quieras' },
            ].map((benefit, i) => (
              <div key={i} className="p-4 bg-white rounded-xl border border-gray-100">
                <div className="w-12 h-12 mx-auto mb-3 bg-unna-green/10 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-unna-green" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    {benefit.icon === 'credit-card' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    )}
                    {benefit.icon === 'clock' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                    {benefit.icon === 'shield' && (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    )}
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">{benefit.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}