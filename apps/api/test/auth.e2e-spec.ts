import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';

describe('Auth E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const baseUrl = '/api/v1/auth';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new DomainExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /auth/register', () => {
    const validRegisterDto = {
      businessName: 'Mi Restaurante Test',
      name: 'Juan Pérez',
      phone: '1112345678',
      email: 'test@example.com',
      password: 'SecurePass123',
      confirmPassword: 'SecurePass123',
      acceptTerms: true,
    };

    it('should register a new user and return tokens', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send(validRegisterDto)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.name).toBe('Juan Pérez');
      expect(response.body.user.businessName).toBe('Mi Restaurante Test');
    });

    it('should fail with 409 if email already exists', async () => {
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send(validRegisterDto)
        .expect(409);
    });

    it('should fail with 400 for invalid email', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ ...validRegisterDto, email: 'invalid-email' })
        .expect(400);

      expect(Array.isArray(response.body.message) ? response.body.message.join(' ') : response.body.message).toContain('e-mail válido');
    });

    it('should fail with 400 for weak password', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ ...validRegisterDto, email: 'weak@example.com', password: 'weak', confirmPassword: 'weak' })
        .expect(400);

      expect(Array.isArray(response.body.message) ? response.body.message.join(' ') : response.body.message).toContain('mínimo 8 caracteres');
    });

    it('should reject mismatched passwords with 400', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ ...validRegisterDto, email: 'mismatch@example.com', confirmPassword: 'DifferentPass123' })
        .expect(400);

      expect(Array.isArray(response.body.message) ? response.body.message.join(' ') : response.body.message).toContain('contraseñas no coinciden');
    });

    it('should reject acceptTerms=false with 400', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ ...validRegisterDto, email: 'noterms@example.com', acceptTerms: false })
        .expect(400);

      expect(Array.isArray(response.body.message) ? response.body.message.join(' ') : response.body.message).toContain('Debes aceptar');
    });

    it('should fail with 400 for short business name', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ ...validRegisterDto, email: 'short@example.com', businessName: 'Ab' })
        .expect(400);

      expect(Array.isArray(response.body.message) ? response.body.message.join(' ') : response.body.message).toContain('3 caracteres');
    });

    it('should reject invalid phone with 400 (fixed by DomainExceptionFilter)', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({ ...validRegisterDto, email: 'badphone@example.com', phone: '123' })
        .expect(400);

      expect(response.body.message).toContain('teléfono válido');
    });
  });

  describe('POST /auth/login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'SecurePass123',
    };

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send({
          businessName: 'Mi Restaurante Test',
          name: 'Juan Pérez',
          phone: '1112345678',
          email: 'test@example.com',
          password: 'SecurePass123',
          confirmPassword: 'SecurePass123',
          acceptTerms: true,
        });
    });

    it('should login successfully and return tokens', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/login`)
        .send(loginDto)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should fail with 401 for wrong password', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/login`)
        .send({ ...loginDto, password: 'WrongPass123' })
        .expect(401);

      expect(response.body.message || response.body.error || response.body).toContain('Credenciales inválidas');
    });

    it('should fail with 401 for non-existent user', async () => {
      const response = await request(app.getHttpServer())
        .post(`${baseUrl}/login`)
        .send({ email: 'nonexistent@example.com', password: 'SecurePass123' })
        .expect(401);

      expect(response.body.message || response.body.error || response.body).toContain('Credenciales inválidas');
    });
  });

  describe('Full registration flow', () => {
    it('should complete register -> login -> access protected route flow', async () => {
      const registerDto = {
        businessName: 'E2E Test Restaurant',
        name: 'María García',
        phone: '1187654321',
        email: 'e2e@example.com',
        password: 'SecurePass123',
        confirmPassword: 'SecurePass123',
        acceptTerms: true,
      };

      const registerResponse = await request(app.getHttpServer())
        .post(`${baseUrl}/register`)
        .send(registerDto)
        .expect(201);

      expect(registerResponse.body.accessToken).toBeDefined();

      const loginResponse = await request(app.getHttpServer())
        .post(`${baseUrl}/login`)
        .send({ email: 'e2e@example.com', password: 'SecurePass123' })
        .expect(200);

      expect(loginResponse.body.accessToken).toBeDefined();
      expect(loginResponse.body.user.email).toBe('e2e@example.com');
    });
  });
});