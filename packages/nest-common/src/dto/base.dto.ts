export interface Base {
  id: string
}

export class BaseDto implements Base {
  id: string
}

export type NoInfer<T> = [T][T extends any ? 0 : never]

export type SelectResult<T, K extends string = string> = string extends K ? T : Pick<T, K & keyof T>

// Get sub-paths for a specific top-level key K from a union of dot paths
type SubPaths<P extends string, K extends string> = P extends `${K}.${infer Rest}` ? Rest : never

// Get unique top-level keys from a union of dot paths
export type PopulateKeys<P extends string> = P extends `${infer H}.${string}` ? H : P

// Nested ref node: defines a populated type and optional nested refs
export interface RefNode {
  type: unknown
  refs?: Record<string, RefNode>
}

// Extract the populated type from a RefNode
type RefType<R extends RefNode> = R['type']

// Extract nested refs from a RefNode (empty record if none)
type RefRefs<R extends RefNode> = R extends { refs: infer C extends Record<string, RefNode> }
  ? C
  : Record<string, never>

export type WithPopulated<
  T,
  TRefs extends Record<string, unknown>,
  P extends string = never,
> = string extends P
  ? T
  : [P] extends [never]
    ? T
    : Omit<T, PopulateKeys<P>> & {
        [K in PopulateKeys<P>]: K extends keyof TRefs
          ? TRefs[K] extends RefNode
            ? WithPopulated<RefType<TRefs[K]>, RefRefs<TRefs[K]>, SubPaths<P, K>>
            : unknown
          : unknown
      }
