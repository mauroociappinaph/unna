interface ErrorBannerProps {
  message: string | null;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null;
  return (
    <div role="alert" className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
      {message}
    </div>
  );
}
