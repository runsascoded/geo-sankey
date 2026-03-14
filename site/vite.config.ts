import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = process.env.VITE_ALLOWED_HOSTS?.split(',') ?? []

export default defineConfig({
  server: {
    port: 3848,
    host: true,
    allowedHosts,
  },
  plugins: [react()],
})
