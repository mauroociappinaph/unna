import type { Metadata } from 'next';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export const metadata: Metadata = {
  title: 'Crear tu negocio | UNNA',
  description: 'Completá el onboarding de tu negocio: datos fiscales, sucursales y horarios.',
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
