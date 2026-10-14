#!/usr/bin/env node
import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

async function buildDocs() {
  console.log('🚀 Building documentation...\n')

  try {
    console.log('📝 Compiling MDX files...')
    process.chdir(path.join(projectRoot, 'docs-build'))
    execSync('pnpm build', { stdio: 'inherit' })

    const srcDocsDir = path.join(
      projectRoot,
      'src',
      'documentation',
      'generated'
    )
    console.log('\n📁 Creating src/documentation directory...')
    await fs.rm(srcDocsDir, { recursive: true, force: true })
    await fs.mkdir(srcDocsDir, { recursive: true })

    const generatedDir = path.join(projectRoot, 'docs-build', 'generated')
    console.log('📋 Copying generated files to src/documentation...')

    const files = await fs.readdir(generatedDir)
    for (const file of files) {
      const srcPath = path.join(generatedDir, file)
      const destPath = path.join(srcDocsDir, file)
      await fs.copyFile(srcPath, destPath)
      console.log(`  ✓ Copied ${file}`)
    }

    console.log('\n✅ Documentation build complete!')
    console.log(`📁 Generated files are now available in src/documentation/`)
  } catch (error) {
    console.error('❌ Documentation build failed:', error)
    process.exit(1)
  }
}

await buildDocs()
