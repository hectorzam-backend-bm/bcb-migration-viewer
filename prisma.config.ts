import 'dotenv/config'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 no longer reads .env on its own, nor does it take the url from the
 * schema's `datasource` block: the CLI configuration lives here.
 *
 * The schema is left exactly as it comes from the backend (prisma/schema.prisma) so
 * it can be replaced without editing it; the only change from the original is
 * `moduleFormat = "esm"`, which Vite needs.
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
})
