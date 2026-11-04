import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { HashingPort } from '@unna/domain';

@Injectable()
export class BcryptHashingAdapter implements HashingPort {
  private readonly rounds = 12;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  async verify(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}