import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalRole, User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByTenantAndEmail(tenantId: string, email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { tenantId, email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  create(data: {
    tenantId: string;
    email: string;
    firstName: string;
    lastName: string;
    globalRole: GlobalRole;
  }): Promise<User> {
    return this.usersRepository.save(this.usersRepository.create(data));
  }
}
