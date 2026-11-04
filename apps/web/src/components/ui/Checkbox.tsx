'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
  description?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', label, error, description, id, ...props }, ref) => {
    const checkboxId = id || label.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        <div className="flex items-start">
          <div className="flex items-center h-5">
            <input
              ref={ref}
              type="checkbox"
              id={checkboxId}
              className={`h-4 w-4 rounded border-gray-300 text-unna-green focus:ring-2 focus:ring-unna-green focus:ring-offset-2 transition-colors ${error ? 'border-red-500' : ''} ${className}`}
              aria-invalid={error ? 'true' : 'false'}
              aria-describedby={error ? `${checkboxId}-error` : undefined}
              {...props}
            />
          </div>
          <div className="ml-3 text-sm">
            <label htmlFor={checkboxId} className="font-medium text-gray-900 cursor-pointer">
              {label}
            </label>
            {description && (
              <p className="mt-0.5 text-gray-500">{description}</p>
            )}
          </div>
        </div>
        {error && (
          <p id={`${checkboxId}-error`} className="mt-1.5 ml-7 error-message" role="alert">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';