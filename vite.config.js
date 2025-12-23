import { defineConfig } from 'vite';

export default defineConfig({
    // Base path for GitHub Pages deployment
    // Use './' for relative paths as it works best for subfolder deployments
    base: './',
    build: {
        outDir: 'dist',
    },
});
