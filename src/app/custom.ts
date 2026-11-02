import type { CatalogueExercise } from '../catalogue'
import type { Category, Equipment, Group } from '../catalogue/labels'
import type { CustomExercise } from '../core/types'

export const customToCatalogue = (c: CustomExercise): CatalogueExercise => ({
  id: c.id, n: c.name, g: c.bodyPart as Group, eq: c.equipment as Equipment, p: c.primary, s: c.secondary,
  c: c.category as Category, l: 'beginner', i: 0, custom: true,
})
