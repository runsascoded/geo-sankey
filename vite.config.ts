import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'react/index': resolve(__dirname, 'react/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      // React is a peer dep; use-kbd is a runtime dep — both stay external
      // so consumers' copies are used (no double-bundle, no version drift).
      external: ['react', 'react/jsx-runtime', 'use-kbd'],
    },
  },
  plugins: [
    dts({
      compilerOptions: { noEmitOnError: false, strict: false, strictNullChecks: false },
      include: ['src/**/*.ts', 'react/**/*.ts', 'react/**/*.tsx'],
    }),
  ],
})
