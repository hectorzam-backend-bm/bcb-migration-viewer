import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 ya no lee .env por su cuenta ni toma la url del bloque `datasource`
 * del schema: la configuración del CLI vive aquí.
 *
 * El schema se deja tal como viene del backend (prisma/schema.prisma) para poder
 * reemplazarlo sin editarlo; lo único que cambia respecto al original es
 * `moduleFormat = "esm"`, que necesita Vite.
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
