import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/server/index.js',
  external: ['@prisma/client', 'prisma'],
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
});

console.log('Server built successfully');
