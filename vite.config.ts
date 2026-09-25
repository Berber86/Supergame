import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  base: './',
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('src/ui/animalGuideData') ||
            id.includes('src/ui/plantGuideData') ||
            id.includes('src/ui/animalGuide')
          ) {
            return 'guide';
          }
          if (id.includes('src/zen/') || id.includes('src/ui/practicePanel')) {
            return 'zen';
          }
          if (id.includes('src/ui/startArt') || id.includes('src/ui/startScreen')) {
            return 'start-screen';
          }
          if (id.includes('src/ui/chroniclePanel') || id.includes('src/ui/chronicleToast')) {
            return 'chronicle';
          }
          if (id.includes('src/ui/devPanel') || id.includes('src/ui/settings') || id.includes('src/ui/gardensPanel')) {
            return 'ui-panels';
          }
        },
      },
    },
  },
});
