import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export function getReleaseNotes(changelog, tag) {
  if (!/^v\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(tag)) throw new Error('Expected a version tag such as v3.2.0')
  const version = tag.slice(1)
  const sections = changelog.replace(/\r\n/g, '\n').split(/^## /m)
  const section = sections.find((entry) => entry.startsWith(`${version} - `))
  if (!section) throw new Error(`No changelog entry found for ${tag}`)
  return `## ${section.trim()}\n`
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
  process.stdout.write(getReleaseNotes(changelog, process.argv[2]))
}
