import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // Bound to every interface on purpose: the dev preview has to be
    // reachable from a phone on the LAN, not just from this machine.
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  }
});
