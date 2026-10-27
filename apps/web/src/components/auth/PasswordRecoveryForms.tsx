'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { registerRequestSchema } from '@unna/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { apiErrorMessage } from '@/lib/api-errors';

// Same email and password rules as the registration (crear-cuenta).
const { email, password, confirmPassword } = registerRequestSchema.innerType().shape;

const forgotSchema = z.object({ email });

const resetSchema = z.object({ password, confirmPassword }).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden.',
  path: ['confirmPassword'],
});

type ForgotForm = z.infer<typeof forgotSchema>;
type ResetForm = z.infer<typeof resetSchema>;

function SubmitError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800" role="alert">
      {message}
    </div>
  );
}

function SuccessMessage({ message }: { message: string }) {
  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800" role="status">
      {message}
    </div>
  );
}

/** Submits the form data once, keeping the API reply or its error message. */
function useSubmission<T>(send: (data: T) => Promise<{ message: string }>, fallback: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (data: T) => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      setSuccess((await send(data)).message);
    } catch (error) {
      setSubmitError(apiErrorMessage(error, fallback));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, submitError, success, submit };
}

/** Asks the API to email a reset link; the reply never says whether the email exists. */
export function ForgotPasswordForm() {
  const { isSubmitting, submitError, success, submit } = useSubmission(
    (data: ForgotForm) => api.forgotPassword({ email: data.email }),
    'No se pudo enviar el link. Probá de nuevo.',
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema), mode: 'onBlur', defaultValues: { email: '' } });

  if (success) return <SuccessMessage message={success} />;

  return (
    <>
      <SubmitError message={submitError} />
      <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
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
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Enviar link
        </Button>
      </form>
    </>
  );
}

/** Sets a new password with the token of the emailed link. */
export function ResetPasswordForm({ token }: { token: string }) {
  const { isSubmitting, submitError, success, submit } = useSubmission(
    (data: ResetForm) => api.resetPassword({ token, password: data.password, confirmPassword: data.confirmPassword }),
    'No se pudo cambiar la contraseña. Probá de nuevo.',
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '' },
  });

  if (success) {
    return (
      <div className="space-y-6 text-center">
        <SuccessMessage message={success} />
        <Link href="/login" className="inline-block font-medium text-unna-green-dark hover:underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <>
      <SubmitError message={submitError} />
      <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
        <div>
          <label htmlFor="password" className="label-field">
            Nueva contraseña <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <Input
            {...register('password')}
            id="password"
            type="password"
            placeholder="••••••••"
            error={errors.password?.message}
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="label-field">
            Repetí la contraseña <span className="text-red-500" aria-hidden="true">*</span>
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
        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Cambiar contraseña
        </Button>
      </form>
    </>
  );
}
