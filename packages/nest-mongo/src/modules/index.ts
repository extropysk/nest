import { DynamicModule, Global, Module } from '@nestjs/common'
import { MongoClient, Db } from 'mongodb'

export const DATABASE = 'database'
const CONFIG = 'config'

interface Config {
  uri: string
}

interface AsyncConfig {
  imports?: any[]
  inject?: any[]
  useFactory: (...args: unknown[]) => Promise<Config> | Config
}

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(options: Config): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE,
          useFactory: async (): Promise<Db> => {
            const client = new MongoClient(options.uri)
            await client.connect()
            return client.db()
          },
        },
      ],
      exports: [DATABASE],
    }
  }

  static forRootAsync(options: AsyncConfig): DynamicModule {
    return {
      module: DatabaseModule,
      imports: options.imports ?? [],
      providers: [
        {
          provide: CONFIG,
          inject: options.inject || [],
          useFactory: options.useFactory,
        },
        {
          provide: DATABASE,
          inject: [CONFIG],
          useFactory: async (mongoOptions: Config): Promise<Db> => {
            const client = new MongoClient(mongoOptions.uri)
            await client.connect()
            return client.db()
          },
        },
      ],
      exports: [DATABASE],
    }
  }
}
