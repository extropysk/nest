import swc from 'vite-plugin-swc-transform'
import path from 'node:path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { name } from './package.json'

const formattedName = name.match(/[^/]+$/)?.[0] ?? name

export default defineConfig({
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
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: formattedName,
    },
    rollupOptions: {
      external: ['@nestjs/common'],
    },
  },
})
