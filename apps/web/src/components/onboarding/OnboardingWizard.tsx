'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Step1Fiscal } from './steps/Step1Fiscal';
import { Step2Sucursales } from './steps/Step2Sucursales';
import { Step3Horarios } from './steps/Step3Horarios';
import { Step4Confirmacion } from './steps/Step4Confirmacion';

export type OnboardingStep = 1 | 2 | 3 | 4;

export interface OnboardingData {
  // Step 1: Datos Fiscales
  businessName: string;
  cuit: string;
  address: {
    street: string;
    number: string;
    floor?: string;
    apartment?: string;
    neighborhood?: string;
    city: string;
    province: string;
    postalCode: string;
    country: string;
  };
  schedule: {
    monday: { open: string; close: string; isClosed: boolean };
    tuesday: { open: string; close: string; isClosed: boolean };
    wednesday: { open: string; close: string; isClosed: boolean };
    thursday: { open: string; close: string; isClosed: boolean };
    friday: { open: string; close: string; isClosed: boolean };
    saturday: { open: string; close: string; isClosed: boolean };
    sunday: { open: string; close: string; isClosed: boolean };
  };
  settings: {
    tradeName: string;
    legalName?: string;
    ivaCondition: 'responsable_inscripto' | 'monotributo' | 'exento' | 'consumidor_final';
    iibbNumber?: string;
    salePoint: string;
    currency: 'ARS' | 'USD';
    timezone: string;
    language: string;
    logoUrl?: string;
  };
  // Step 2: Sucursales
  sucursales: Array<{
    name: string;
    address: {
      street: string;
      number: string;
      floor?: string;
      apartment?: string;
      neighborhood?: string;
      city: string;
      province: string;
      postalCode: string;
      country: string;
    };
    phone: string;
    email: string;
    schedule?: {
      monday: { open: string; close: string; isClosed: boolean };
      tuesday: { open: string; close: string; isClosed: boolean };
      wednesday: { open: string; close: string; isClosed: boolean };
      thursday: { open: string; close: string; isClosed: boolean };
      friday: { open: string; close: string; isClosed: boolean };
      saturday: { open: string; close: string; isClosed: boolean };
      sunday: { open: string; close: string; isClosed: boolean };
    };
    isMain?: boolean;
  }>;
}

const STEPS: { id: OnboardingStep; title: string; description: string }[] = [
  { id: 1, title: 'Datos Fiscales', description: 'Información legal y domicilio del negocio' },
  { id: 2, title: 'Sucursales', description: 'Ubicaciones, teléfonos y horarios por local' },
  { id: 3, title: 'Horarios', description: 'Horarios de atención del negocio principal' },
  { id: 4, title: 'Confirmación', description: 'Revisá y confirmá tu onboarding' },
];

const initialData: OnboardingData = {
  businessName: '',
  cuit: '',
  address: {
    street: '',
    number: '',
    floor: '',
    apartment: '',
    neighborhood: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Argentina',
  },
  schedule: {
    monday: { open: '09:00', close: '23:00', isClosed: false },
    tuesday: { open: '09:00', close: '23:00', isClosed: false },
    wednesday: { open: '09:00', close: '23:00', isClosed: false },
    thursday: { open: '09:00', close: '23:00', isClosed: false },
    friday: { open: '09:00', close: '23:00', isClosed: false },
    saturday: { open: '09:00', close: '23:00', isClosed: false },
    sunday: { open: '00:00', close: '00:00', isClosed: true },
  },
  settings: {
    tradeName: '',
    legalName: '',
    ivaCondition: 'responsable_inscripto',
    iibbNumber: '',
    salePoint: '0001',
    currency: 'ARS',
    timezone: 'America/Argentina/Buenos_Aires',
    language: 'es-AR',
    logoUrl: '',
  },
  sucursales: [
    {
      name: '',
      address: {
        street: '',
        number: '',
        floor: '',
        apartment: '',
        neighborhood: '',
        city: '',
        province: '',
        postalCode: '',
        country: 'Argentina',
      },
      phone: '',
      email: '',
      isMain: true,
    },
  ],
};

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(1);
  const [data, setData] = useState<OnboardingData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const updateNested = (partial: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const nextStep = () => {
    if (currentStep < 4) setCurrentStep((currentStep + 1) as OnboardingStep);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as OnboardingStep);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const token = localStorage.getItem('auth_token');

      const response = await fetch(`${apiUrl}/api/v1/businesses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al crear el negocio');
      }

      setSubmitSuccess(true);
      localStorage.setItem('auth_token', result.accessToken);
      localStorage.setItem('refresh_token', result.refreshToken);

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Fiscal data={data} onChange={updateNested} />;
      case 2:
        return <Step2Sucursales data={data.sucursales} onChange={(sucursales) => updateNested({ sucursales })} />;
      case 3:
        return <Step3Horarios data={data.schedule} onChange={(schedule) => updateNested({ schedule })} />;
      case 4:
        return <Step4Confirmacion data={data} onSubmit={handleSubmit} isSubmitting={isSubmitting} submitError={submitError} submitSuccess={submitSuccess} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="container-custom">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2" aria-label="UNNA - Inicio">
              <svg className="w-8 h-8 text-unna-green" fill="currentColor" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M16 2L4 8v16l12 6 12-6V8L16 2zm0 2.5L25.5 9 16 13.5 6.5 9 16 4.5zM6 10.5l9 4.5 9-4.5v11L16 28.5 6 24v-13.5z" />
              </svg>
              <span className="text-xl font-bold text-gray-900 hidden sm:block">UNNA</span>
            </Link>

            {/* Progress Steps */}
            <nav className="flex items-center gap-2 md:gap-4" aria-label="Progreso del onboarding">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center" data-testid={`step-circle-${step.id}`}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        index + 1 < currentStep
                          ? 'bg-unna-green text-white'
                          : index + 1 === currentStep
                          ? 'bg-unna-green text-white ring-2 ring-unna-green ring-offset-2'
                          : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {index + 1 < currentStep ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        step.id
                      )}
                    </div>
                    <span className={`hidden sm:block text-sm font-medium ${
                      index + 1 <= currentStep ? 'text-gray-900' : 'text-gray-400'
                    }`}>
                      {step.title}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`hidden md:block w-16 h-0.5 rounded transition-colors ${
                        index + 1 < currentStep ? 'bg-unna-green' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </nav>

            <div className="text-right">
              <p className="text-sm text-gray-600">
                Paso {currentStep} de {STEPS.length}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-custom py-8 md:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Step Title */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              {STEPS[currentStep - 1].title}
            </h1>
            <p className="mt-2 text-gray-600">
              {STEPS[currentStep - 1].description}
            </p>
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8">
            {renderStep()}
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Anterior
            </Button>

            {currentStep < 4 ? (
              <Button onClick={nextStep} disabled={isSubmitting}>
                Siguiente
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                loading={isSubmitting}
                disabled={isSubmitting || submitSuccess}
              >
                {submitSuccess ? '¡Completado!' : 'Finalizar onboarding'}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}