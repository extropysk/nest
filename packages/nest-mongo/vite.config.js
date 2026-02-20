import { createViteConfig } from '../../vite.config.base.js'
import { name } from './package.json'

export default createViteConfig({
  name,
  dirname: import.meta.dirname,
  external: ['mongodb', '@nestjs/common', '@extropysk/nest-common'],
})
