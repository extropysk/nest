import { Base, NoInfer, WithPopulated, SelectResult, PopulateKeys } from '../dto'
import { PaginatedQuery, PaginatedResponse } from '../dto'

export interface IBaseRepository<
  T extends Base,
  TRefs extends Record<string, unknown> = Record<string, unknown>,
  TInsert = Omit<T, 'id'>,
> {
  find<K extends string = string, P extends string = never>(
    query: PaginatedQuery<K, P>,
  ): Promise<PaginatedResponse<WithPopulated<T, TRefs, NoInfer<P>>, K | PopulateKeys<NoInfer<P>>>>

  findById<K extends string = string, P extends string = never>(
    id: string,
    options?: { select?: K[]; populate?: P[] },
  ): Promise<SelectResult<
    WithPopulated<T, TRefs, NoInfer<P>>,
    NoInfer<K> | PopulateKeys<NoInfer<P>>
  > | null>

  create(doc: TInsert): Promise<T>

  updateById(id: string, update: Partial<TInsert>): Promise<boolean>

  deleteById(id: string): Promise<boolean>
}
