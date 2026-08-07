import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Proves two things in one Postman call: the app is up, and the database
   * it's configured to talk to is actually reachable — whichever one that
   * is right now, local Docker Postgres or Azure Postgres Flexible Server.
   */
  @Public()
  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (error) {
      throw new ServiceUnavailableException(`Database unreachable: ${(error as Error).message}`);
    }
    return { status: 'ok', database: 'connected', timestamp: new Date().toISOString() };
  }
}
