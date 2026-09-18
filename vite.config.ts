import { defineConfig } from 'vite'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  // El cliente de Prisma y el driver `pg` sólo corren en el servidor.
  ssr: { external: ['@prisma/client', '@prisma/adapter-pg', 'pg'] },
  // Y no deben acabar en el paquete pre-optimizado del navegador: src/server/db.ts
  // los importa detrás de `import.meta.env.SSR`, así que en el cliente nunca se piden.
  optimizeDeps: { exclude: ['@prisma/client', '@prisma/adapter-pg', 'pg'] },
})
