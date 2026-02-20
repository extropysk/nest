import { DynamicModule, Module } from '@nestjs/common'

export abstract class IStorageService {
  abstract set<T>(key: string, value: T, exp?: number): Promise<void>
  abstract get<T>(key: string): Promise<T | null>
  abstract del(key: string): Promise<number>
}

interface Config {
  useFactory: () => IStorageService
}

interface AsyncConfig {
  useFactory: (...args: unknown[]) => IStorageService | Promise<IStorageService>
  inject?: any[]
  imports?: any[]
}

@Module({})
export class StorageModule {
  static forRoot(options: Config): DynamicModule {
    return {
      module: StorageModule,
      global: true,
      providers: [
        {
          provide: IStorageService,
          useFactory: () => options.useFactory(),
        },
      ],
      exports: [IStorageService],
    }
  }

  static forRootAsync(options: AsyncConfig): DynamicModule {
    return {
      module: StorageModule,
      global: true,
      imports: options?.imports || [],
      providers: [
        {
          provide: IStorageService,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ],
      exports: [IStorageService],
    }
  }
}
