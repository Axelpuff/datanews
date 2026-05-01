import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];
  try {
    // @ts-ignore
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch {}
  return {
    plugins,
    // The openmeteo wasm decoder uses `new URL('om_reader_wasm.web.wasm', import.meta.url)`,
    // which only resolves correctly when the JS module is served from its original
    // node_modules path (Vite's dep pre-bundling copies the JS but not the sibling .wasm).
    optimizeDeps: {
      exclude: ['@openmeteo/weather-map-layer', '@openmeteo/file-format-wasm'],
    },
  };
})
