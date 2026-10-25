import { z } from 'zod';

export const registerRequestSchema = z.object({
  businessName: z
    .string()
    .min(1, 'Este campo es obligatorio')
    .min(3, 'El nombre del negocio debe tener más de 3 caracteres.')
    .max(45, 'El nombre del negocio debe tener menos de 45 caracteres.')
    .regex(/^[a-zA-Z0-9\s&_\-]+$/, 'Solamente caracteres alfanuméricos y los símbolos: &, - y _.'),
  name: z
    .string()
    .min(1, 'Este campo es obligatorio')
    .min(3, 'Tu nombre debe tener más de 3 caracteres.')
    .max(45, 'Tu nombre debe tener menos de 45 caracteres.'),
  phone: z
    .string()
    .min(1, 'Este campo es obligatorio')
    .regex(/^(\+?54)?9?\d{2}\d{4}\d{4}$/, 'Ingresá un teléfono válido. Ej.: 11 1234 5678'),
  email: z
    .string()
    .min(1, 'Este campo es obligatorio')
    .email('Ingresá un e-mail válido. Ej.: nombre@gmail.com'),
  password: z
    .string()
    .min(1, 'Este campo es obligatorio')
    .min(8, 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.')
    .regex(/[A-Z]/, 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.')
    .regex(/[a-z]/, 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.')
    .regex(/[0-9]/, 'Debe contener mínimo 8 caracteres, mayúsculas, minúsculas y un número.'),
  confirmPassword: z.string().min(1, 'Este campo es obligatorio'),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'Debes aceptar las Condiciones y Políticas.',
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden.',
  path: ['confirmPassword'],
});

export const loginRequestSchema = z.object({
  email: z.string().min(1, 'Email es obligatorio').email('Email inválido'),
  password: z.string().min(1, 'Contraseña es obligatoria'),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const registerResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    businessName: z.string(),
  }),
});

export type RegisterResponse = z.infer<typeof registerResponseSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    businessName: z.string(),
  }),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;