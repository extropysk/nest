import { IStorageService } from '@extropysk/nest-common'

import { Injectable, OnModuleInit } from '@nestjs/common'
import { Collection, Db } from 'mongodb'
import { DATABASE } from '../modules'

interface StorageDocument {
  key: string
  value: unknown
  expiresAt?: Date
}

interface Config {
  collectionName?: string
}

@Injectable()
export class MongoStorageService extends IStorageService implements OnModuleInit {
  protected collection: Collection<StorageDocument>

  static create(config?: Config) {
    return {
      inject: [DATABASE],
      useFactory: (db: Db) => new MongoStorageService(db, config),
    }
  }

  constructor(db: Db, { collectionName = 'storage' }: Config = {}) {
    super()
    this.collection = db.collection<StorageDocument>(collectionName)
  }

  async onModuleInit() {
    await this.collection.createIndex({ key: 1 }, { unique: true })
    await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  }

  async set<T>(key: string, value: T, exp?: number): Promise<void> {
    const doc: StorageDocument = {
      key,
      value,
      expiresAt: exp ? new Date(Date.now() + exp) : undefined,
    }

    await this.collection.replaceOne({ key }, doc, { upsert: true })
  }

  async get<T>(key: string): Promise<T | null> {
    const doc = await this.collection.findOne({ key })
    return doc ? (doc.value as T) : null
  }

  async del(key: string): Promise<number> {
    const result = await this.collection.deleteOne({ key })
    return result.deletedCount
  }
}
