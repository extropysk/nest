import {
  Collection,
  Db,
  Document,
  Filter,
  ObjectId,
  OptionalUnlessRequiredId,
  WithId,
} from 'mongodb'
import { Base, NoInfer, PopulateKeys, WithPopulated, SelectResult } from '@extropysk/nest-common'
import { PaginatedQuery, PaginatedResponse } from '@extropysk/nest-common'
import { IBaseRepository } from '@extropysk/nest-common'
import {
  convertWhereToMongo,
  convertSortToMongo,
  buildProjection,
  buildLookupStages,
  RefsSchema,
} from '../utils'

interface FindOptions<K extends string = string, P extends string = never> {
  skip?: number
  limit?: number
  sort?: Record<string, 1 | -1>
  select?: K[]
  populate?: P[]
}

export abstract class BaseRepository<
  TDocument extends Base,
  TRefs extends Record<string, unknown> = Record<string, unknown>,
  TInsert = Omit<TDocument, 'id'>,
> implements IBaseRepository<TDocument, TRefs, TInsert>
{
  protected collection: Collection<TDocument>
  protected db: Db
  protected refs: RefsSchema<TRefs>

  constructor(db: Db, collectionName: string, refs: RefsSchema<TRefs> = {} as RefsSchema<TRefs>) {
    this.db = db
    this.collection = db.collection<TDocument>(collectionName)
    this.refs = refs
  }

  protected toJSON(doc: WithId<TDocument>, select?: string[]): TDocument {
    const { _id, ...rest } = doc
    if (select && !select.includes('id')) {
      return rest as unknown as TDocument
    }
    return { ...rest, id: _id.toString() } as unknown as TDocument
  }

  async findMany<K extends string = string, P extends string = never>(
    filter: Filter<TDocument> = {},
    options: FindOptions<K, P> = {} as FindOptions<K, P>,
  ): Promise<
    SelectResult<WithPopulated<TDocument, TRefs, NoInfer<P>>, K | PopulateKeys<NoInfer<P>>>[]
  > {
    const { skip, limit, sort, select, populate } = options

    if (populate?.length) {
      const pipeline: Document[] = [{ $match: filter }]

      if (sort && Object.keys(sort).length > 0) {
        pipeline.push({ $sort: sort })
      }
      if (skip !== undefined) {
        pipeline.push({ $skip: skip })
      }
      if (limit !== undefined) {
        pipeline.push({ $limit: limit })
      }

      pipeline.push(...buildLookupStages(populate, this.refs))

      if (select?.length) {
        const topLevelPopulate = [...new Set(populate.map(p => p.split('.')[0]))]
        const allFields = [...new Set([...select, ...topLevelPopulate])]
        pipeline.push({ $project: buildProjection(allFields) })
      }

      const rawDocs = await this.collection.aggregate<WithId<TDocument>>(pipeline).toArray()
      return rawDocs.map(doc => this.toJSON(doc, select)) as SelectResult<
        WithPopulated<TDocument, TRefs, NoInfer<P>>,
        K | PopulateKeys<NoInfer<P>>
      >[]
    }

    const projection = select?.length ? buildProjection(select) : undefined
    let cursor = this.collection.find(filter, projection ? { projection } : {})

    if (sort && Object.keys(sort).length > 0) {
      cursor = cursor.sort(sort)
    }
    if (skip !== undefined) {
      cursor = cursor.skip(skip)
    }
    if (limit !== undefined) {
      cursor = cursor.limit(limit)
    }

    const docs = await cursor.toArray()
    return docs.map(doc => this.toJSON(doc, select)) as SelectResult<
      WithPopulated<TDocument, TRefs, NoInfer<P>>,
      K | PopulateKeys<NoInfer<P>>
    >[]
  }

  async find<K extends string = string, P extends string = never>(
    query: PaginatedQuery<K, P>,
  ): Promise<
    PaginatedResponse<WithPopulated<TDocument, TRefs, NoInfer<P>>, K | PopulateKeys<NoInfer<P>>>
  > {
    const { where, sort, limit, page, select, populate } = query

    const filter = where ? (convertWhereToMongo(where) as Filter<TDocument>) : {}
    const sortObj = convertSortToMongo(sort)

    const totalDocs = await this.count(filter)
    const totalPages = Math.ceil(totalDocs / limit)
    const skip = (page - 1) * limit

    const docs = await this.findMany(filter, {
      skip,
      limit,
      sort: sortObj,
      select,
      populate,
    })

    return {
      docs,
      totalDocs,
      limit,
      page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    }
  }

  async findOne<K extends string = string, P extends string = never>(
    filter: Filter<TDocument>,
    options?: { select?: K[]; populate?: P[] },
  ): Promise<SelectResult<
    WithPopulated<TDocument, TRefs, NoInfer<P>>,
    K | PopulateKeys<NoInfer<P>>
  > | null> {
    if (options?.populate?.length || options?.select?.length) {
      const docs = await this.findMany(filter, {
        limit: 1,
        select: options.select,
        populate: options.populate,
      })
      return (docs[0] ?? null) as SelectResult<
        WithPopulated<TDocument, TRefs, NoInfer<P>>,
        K | PopulateKeys<NoInfer<P>>
      > | null
    }
    const doc = await this.collection.findOne(filter)
    return (doc ? this.toJSON(doc) : null) as SelectResult<
      WithPopulated<TDocument, TRefs, NoInfer<P>>,
      K | PopulateKeys<NoInfer<P>>
    > | null
  }

  async findById<K extends string = string, P extends string = never>(
    id: string,
    options?: { select?: K[]; populate?: P[] },
  ): Promise<SelectResult<
    WithPopulated<TDocument, TRefs, NoInfer<P>>,
    NoInfer<K> | PopulateKeys<NoInfer<P>>
  > | null> {
    if (!ObjectId.isValid(id)) {
      return null
    }
    const filter = { _id: new ObjectId(id) } as Filter<TDocument>
    const docs = await this.findMany(filter, {
      limit: 1,
      select: options?.select,
      populate: options?.populate,
    })
    return (docs[0] ?? null) as SelectResult<
      WithPopulated<TDocument, TRefs, NoInfer<P>>,
      NoInfer<K> | PopulateKeys<NoInfer<P>>
    > | null
  }

  async count(filter: Filter<TDocument> = {}): Promise<number> {
    return this.collection.countDocuments(filter)
  }

  async create(doc: TInsert): Promise<TDocument> {
    const result = await this.collection.insertOne(doc as OptionalUnlessRequiredId<TDocument>)
    return this.toJSON({ ...doc, _id: result.insertedId } as WithId<TDocument>)
  }

  async updateOne(filter: Filter<TDocument>, update: Partial<TInsert>): Promise<boolean> {
    const result = await this.collection.updateOne(filter, { $set: update as Partial<TDocument> })
    return result.modifiedCount > 0
  }

  async updateById(id: string, update: Partial<TInsert>): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false
    }
    return this.updateOne({ _id: new ObjectId(id) } as Filter<TDocument>, update)
  }

  async upsert(filter: Filter<TDocument>, update: Partial<TDocument>): Promise<TDocument> {
    const doc = await this.collection.findOneAndUpdate(
      filter,
      { $set: update as Partial<TDocument> },
      { upsert: true, returnDocument: 'after' },
    )
    return this.toJSON(doc as WithId<TDocument>)
  }

  async deleteOne(filter: Filter<TDocument>): Promise<boolean> {
    const result = await this.collection.deleteOne(filter)
    return result.deletedCount > 0
  }

  async deleteById(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false
    }
    return this.deleteOne({ _id: new ObjectId(id) } as Filter<TDocument>)
  }
}
