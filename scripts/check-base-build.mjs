import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

execFileSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_BASE_PATH: '/Supergame/' },
})

const index = readFileSync('dist/index.html', 'utf8')
if (!index.includes('/Supergame/assets/') || !index.includes('/Supergame/manifest.webmanifest')) {
  throw new Error('HTML does not honor VITE_BASE_PATH')
}

const assetFiles = readdirSync('dist/assets').filter((file) => /\.(js|css)$/.test(file))
for (const file of assetFiles) {
  const content = readFileSync(join('dist/assets', file), 'utf8')
  if (/["'(]\/art\//.test(content)) throw new Error(`Root-absolute art path found in ${file}`)
}

const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'))
if (manifest.start_url !== './' || manifest.scope !== './') {
  throw new Error('PWA manifest is not relative to its deployment scope')
}

console.log('Subpath build verified at /Supergame/')
