import { createServerFn } from '@tanstack/react-start'
import { db, describirFalla } from './db'

export type Conteos = {
  empresas: number
  servicios: number
  terminales: number
  rutas: number
  tramos: number
}

/** Conteos vivos del riel. Excluye borrados lógicos: el riel cuenta lo vigente. */
export const obtenerConteos = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ conteos: Conteos | null; falla: ReturnType<typeof describirFalla> | null }> => {
    try {
      const [empresas, servicios, terminales, rutas, tramos] = await Promise.all([
        db.company.count({ where: { deletedAt: null } }),
        db.service.count({ where: { deletedAt: null } }),
        db.station.count({ where: { deletedAt: null } }),
        db.route.count({ where: { deletedAt: null } }),
        db.segment.count({ where: { deletedAt: null } }),
      ])
      return { conteos: { empresas, servicios, terminales, rutas, tramos }, falla: null }
    } catch (error) {
      console.error('[conteos]', error)
      return { conteos: null, falla: describirFalla(error) }
    }
  },
)
