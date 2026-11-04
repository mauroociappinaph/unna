export interface EmailPort {
  sendEmail(to: string, subject: string, html: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void>;
  sendEmailVerificationEmail(to: string, verificationLink: string): Promise<void>;
}

export interface EmailConfig {
  from: string;
  replyTo?: string;
}