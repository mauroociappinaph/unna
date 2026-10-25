import { User } from '../aggregates/user.aggregate';
import { Business } from '../aggregates/business.aggregate';

export interface RepositoryPort<T extends { id: string }> {
  save(aggregate: T): Promise<void>;
  findById(id: string): Promise<T | null>;
  delete(id: string): Promise<void>;
}

export interface UserRepositoryPort extends RepositoryPort<User> {
  findByEmail(email: string): Promise<User | null>;
  existsByEmail(email: string): Promise<boolean>;
}

export interface BusinessRepositoryPort extends RepositoryPort<Business> {
  findByOwnerId(ownerId: string): Promise<Business[]>;
  existsByName(name: string): Promise<boolean>;
}