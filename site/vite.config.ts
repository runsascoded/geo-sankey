import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = process.env.VITE_ALLOWED_HOSTS?.split(',') ?? []

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  server: {
    port: 7251,
    host: true,
    allowedHosts,
  },
  plugins: [react()],
})
