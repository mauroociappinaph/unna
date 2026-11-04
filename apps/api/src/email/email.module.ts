import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ResendEmailAdapter } from './resend-email.adapter';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'RESEND_API_KEY',
      useFactory: (config: ConfigService) => config.get<string>('RESEND_API_KEY') || '',
      inject: [ConfigService],
    },
    {
      provide: 'EMAIL_CONFIG',
      useFactory: (config: ConfigService) => ({
        from: config.get<string>('EMAIL_FROM') || 'UNNA <noreply@unna.com.ar>',
        replyTo: config.get<string>('EMAIL_REPLY_TO'),
      }),
      inject: [ConfigService],
    },
    ResendEmailAdapter,
    {
      provide: 'EmailPort',
      useExisting: ResendEmailAdapter,
    },
  ],
  exports: [ResendEmailAdapter, 'EmailPort'],
})
export class EmailModule {}