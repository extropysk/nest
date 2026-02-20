import { DynamicModule, Global, Module } from '@nestjs/common'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

export const DATABASE = Symbol('database')

const CONFIG = 'config'

interface Config {
  url: string
  schema: Record<string, unknown>
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
          useFactory: () => {
            const pool = new Pool({ connectionString: options.url })
            return drizzle(pool, { schema: options.schema })
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
          useFactory: (config: Config) => {
            const pool = new Pool({ connectionString: config.url })
            return drizzle(pool, { schema: config.schema })
          },
        },
      ],
      exports: [DATABASE],
    }
  }
}
