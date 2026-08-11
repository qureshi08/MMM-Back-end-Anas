import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validate } from './config/env.validation';
import { buildDataSourceOptions } from './config/database.config';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { DatasetsModule } from './modules/datasets/datasets.module';
import { OtpModule } from './modules/otp/otp.module';
import { SamplesModule } from './modules/samples/samples.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDataSourceOptions({
          DB_HOST: config.getOrThrow('DB_HOST'),
          DB_PORT: config.getOrThrow('DB_PORT'),
          DB_USERNAME: config.getOrThrow('DB_USERNAME'),
          DB_PASSWORD: config.getOrThrow('DB_PASSWORD'),
          DB_NAME: config.getOrThrow('DB_NAME'),
          DB_SSL: config.getOrThrow('DB_SSL'),
          DB_SYNCHRONIZE: config.getOrThrow('DB_SYNCHRONIZE'),
          DB_LOGGING: config.getOrThrow('DB_LOGGING'),
        }),
    }),
    HealthModule,
    AuthModule,
    TenantsModule,
    UsersModule,
    ProjectsModule,
    DatasetsModule,
    OtpModule,
    SamplesModule,
  ],
})
export class AppModule {}
