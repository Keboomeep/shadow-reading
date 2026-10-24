import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// `npm run dev` is plain http. `npm run dev:https` adds a self-signed certificate,
// which the iPhone needs before it will allow the microphone (recording).
export default defineConfig({
  plugins: [react(), ...(process.env.HTTPS ? [basicSsl()] : [])],
})
