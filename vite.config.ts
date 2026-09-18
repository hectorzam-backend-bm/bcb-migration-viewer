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
  // The Prisma client and the `pg` driver only run on the server.
  ssr: { external: ['@prisma/client', '@prisma/adapter-pg', 'pg'] },
  // And they must not end up in the browser's pre-optimized bundle: src/server/db.ts
  // imports them behind `import.meta.env.SSR`, so the client never asks for them.
  optimizeDeps: { exclude: ['@prisma/client', '@prisma/adapter-pg', 'pg'] },
})
