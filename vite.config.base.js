import swc from 'vite-plugin-swc-transform'
import path from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export function createViteConfig({ name, dirname, external = [] }) {
  const formattedName = name.match(/[^/]+$/)?.[0] ?? name

  return defineConfig({
    plugins: [
      dts(),
      swc({
        swcOptions: {
          jsc: {
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
          },
        },
      }),
    ],
    build: {
      lib: {
        entry: path.resolve(dirname, 'src/index.ts'),
        name: formattedName,
      },
      rollupOptions: {
        external,
      },
    },
  })
}
