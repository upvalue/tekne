import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateOpenAPI } from '../src/server/api'

const version = '0.22.0'
const generator = process.env.OPENAPI_TO_RUST ?? 'openapi-to-rust'
const installed = spawnSync(generator, ['--version'], { encoding: 'utf8' })
if (
  installed.status !== 0 ||
  installed.stdout.trim() !== `openapi-to-rust ${version}`
) {
  throw new Error(
    `Install the pinned generator: cargo install --locked openapi-to-rust --version ${version}`
  )
}

const check = process.argv.slice(2)
if (check.some((arg) => arg !== '--check'))
  throw new Error('Usage: generate:rust-client [--check]')

const temporary = await mkdtemp(join(tmpdir(), 'tekne-client-'))
try {
  await writeFile(
    join(temporary, 'openapi.json'),
    JSON.stringify(await generateOpenAPI())
  )
  const output = fileURLToPath(new URL('../cli/src/generated', import.meta.url))
  // Select operations here as CLI commands are added. Schemas come from oRPC.
  await writeFile(
    join(temporary, 'generator.toml'),
    `
[generator]
spec_path = "openapi.json"
output_dir = ${JSON.stringify(output)}
module_name = "tekne"

[features]
enable_async_client = true

[client]
operations = ["doc.loadDoc"]
prune_models = true

[http_client]
timeout_seconds = 20
`
  )
  const result = spawnSync(
    generator,
    ['generate', '--config', join(temporary, 'generator.toml'), ...check],
    {
      stdio: 'inherit',
    }
  )
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  await rm(temporary, { recursive: true, force: true })
}
