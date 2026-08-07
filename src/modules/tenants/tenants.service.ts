import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  findByExternalKey(externalKey: string): Promise<Tenant | null> {
    return this.tenantsRepository.findOne({ where: { externalKey } });
  }

  create(data: { name: string; externalKey: string }): Promise<Tenant> {
    return this.tenantsRepository.save(this.tenantsRepository.create(data));
  }
}
