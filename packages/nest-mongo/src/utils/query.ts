import { RefNode } from '@extropysk/nest-common'

type PayloadOperator =
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'greater_than_equal'
  | 'less_than'
  | 'less_than_equal'
  | 'like'
  | 'contains'
  | 'in'
  | 'not_in'
  | 'exists'

type PayloadWhere = {
  [key: string]: { [K in PayloadOperator]?: unknown } | PayloadWhere[] | PayloadWhere
}

type MongoFilter = Record<string, unknown>

const operatorMap: Record<PayloadOperator, string> = {
  equals: '$eq',
  not_equals: '$ne',
  greater_than: '$gt',
  greater_than_equal: '$gte',
  less_than: '$lt',
  less_than_equal: '$lte',
  like: '$regex',
  contains: '$regex',
  in: '$in',
  not_in: '$nin',
  exists: '$exists',
}

function convertOperatorValue(operator: PayloadOperator, value: unknown): unknown {
  if (operator === 'like' || operator === 'contains') {
    return { $regex: String(value), $options: 'i' }
  }
  return { [operatorMap[operator]]: value }
}

export function convertWhereToMongo(where: Record<string, unknown>): MongoFilter {
  const result: MongoFilter = {}

  for (const [key, value] of Object.entries(where)) {
    if (key === 'and' && Array.isArray(value)) {
      result['$and'] = value.map(condition => convertWhereToMongo(condition as PayloadWhere))
    } else if (key === 'or' && Array.isArray(value)) {
      result['$or'] = value.map(condition => convertWhereToMongo(condition as PayloadWhere))
    } else if (typeof value === 'object' && value !== null) {
      const operators = Object.keys(value) as PayloadOperator[]
      const isOperatorObject = operators.some(op => op in operatorMap)

      if (isOperatorObject) {
        const merged: Record<string, unknown> = {}
        for (const op of operators) {
          if (op in operatorMap) {
            const opValue = (value as Record<string, unknown>)[op]
            Object.assign(merged, convertOperatorValue(op, opValue))
          }
        }
        result[key] = merged
      } else {
        result[key] = convertWhereToMongo(value as PayloadWhere)
      }
    } else {
      result[key] = { $eq: value }
    }
  }

  return result
}

export function convertSortToMongo(sort?: string): Record<string, 1 | -1> {
  if (!sort) return {}

  const descending = sort.startsWith('-')
  const field = descending ? sort.slice(1) : sort

  return { [field]: descending ? -1 : 1 }
}

export function selectFields<T extends Record<string, any>>(doc: T, select?: string): Partial<T> {
  if (!select) return doc

  const fields = select.split(',').map(f => f.trim())
  const result: Partial<T> = {}

  for (const field of fields) {
    if (field in doc) {
      result[field as keyof T] = doc[field as keyof T]
    }
  }

  return result
}

export function buildProjection(select: string[]): Record<string, 1> {
  const projection: Record<string, 1> = {}
  for (const field of select) {
    projection[field] = 1
  }
  return projection
}

export interface RefDefinition {
  collection: string
  isMany?: boolean
  refs?: Record<string, RefDefinition>
}

export type RefsSchema<TRefs extends Record<string, unknown> = Record<string, unknown>> = {
  [K in keyof TRefs & string]: TRefs[K] extends RefNode ? RefSchemaEntry<TRefs[K]> : RefDefinition
}

type RefSchemaEntry<R extends RefNode> = R extends { refs: infer C extends Record<string, RefNode> }
  ? { collection: string; isMany?: boolean; refs: RefsSchema<C> }
  : { collection: string; isMany?: boolean }

export function buildLookupStages(
  populate: string[],
  refs: Record<string, RefDefinition>,
): Record<string, unknown>[] {
  const stages: Record<string, unknown>[] = []

  const grouped = new Map<string, string[]>()
  for (const path of populate) {
    const dotIndex = path.indexOf('.')
    const head = dotIndex === -1 ? path : path.substring(0, dotIndex)
    const rest = dotIndex === -1 ? null : path.substring(dotIndex + 1)

    const existing = grouped.get(head)
    if (existing) {
      if (rest) existing.push(rest)
    } else {
      grouped.set(head, rest ? [rest] : [])
    }
  }

  for (const [field, subPaths] of grouped) {
    const ref = refs[field]
    if (!ref) continue

    if (subPaths.length > 0 && ref.refs) {
      const nestedStages = buildLookupStages(subPaths, ref.refs)
      stages.push({
        $lookup: {
          from: ref.collection,
          localField: field,
          foreignField: '_id',
          pipeline: nestedStages,
          as: field,
        },
      })
    } else {
      stages.push({
        $lookup: {
          from: ref.collection,
          localField: field,
          foreignField: '_id',
          as: field,
        },
      })
    }

    if (!ref.isMany) {
      stages.push({
        $unwind: { path: `$${field}`, preserveNullAndEmptyArrays: true },
      })
    }
  }

  return stages
}
