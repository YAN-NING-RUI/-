import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, relative } from 'node:path'
import type { MarkdownOptions } from 'vitepress'

type Markdown = Parameters<NonNullable<MarkdownOptions['config']>>[0]
type Tokens = ReturnType<Markdown['parse']>
type Section = { id: string; content: string; close: Tokens[number] }

const localTime = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
})

function readSections(source: string, tokens: Tokens): Section[] {
  const lines = source.split('\n')
  const headings = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token }) => token.type === 'heading_open' && token.level === 0 && token.map)

  return headings.flatMap(({ token, index }, position) => {
    const id = token.attrGet('id')
    if (!id || token.tag === 'h1') return []

    // Count a heading and its own text up to the next heading at any depth.
    const nextLine = headings[position + 1]?.token.map?.[0]
    const content = lines.slice(token.map![0], nextLine).join('\n').trimEnd()
    return [{ id, content, close: tokens[index + 2] }]
  })
}

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
}

function* history(root: string, path: string) {
  const log = git(root, ['log', '--follow', '-M', '--format=%x00%H %ct', '--name-status', '-z', '--', path])
  const fields = log.split('\0')

  for (let index = 0; index < fields.length; index++) {
    const commit = /^([a-f0-9]+) (\d+)$/.exec(fields[index])
    if (!commit) continue

    const [, hash, seconds] = commit
    const status = fields[index + 1]?.trim()
    yield { hash, path, time: Number(seconds) * 1000, deleted: status === 'D' }

    // --follow reports renames as status, old path, new path in the NUL-delimited output.
    if (status?.startsWith('R')) path = fields[index + 2]
  }
}

export function sectionUpdates(md: Markdown) {
  const root = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).stdout?.trim()
  if (!root) return

  const shallow = git(root, ['rev-parse', '--is-shallow-repository']).trim() === 'true'
  const cache = new Map<string, { time: number; sections: Map<string, string> }[]>()

  md.core.ruler.push('section-updates', state => {
    // Local search uses a different render path. Keep timestamps out of its index.
    if (!state.env.realPath) return

    const sections = readSections(state.src, state.tokens)
    if (sections.length === 0) return

    const path = relative(root, state.env.realPath).replaceAll('\\', '/')
    if (!cache.has(path)) {
      cache.set(path, Array.from(history(root, path), revision => {
        if (revision.deleted) return { time: revision.time, sections: new Map<string, string>() }

        const source = git(root, ['show', `${revision.hash}:${revision.path}`])
          .replace(/\r\n?/g, '\n')
          .replace(/^\uFEFF/, '')
          .replace(/^---\s*\n[\s\S]*?\n---[^\S\n]*(?:\n|$)/, '')
        return {
          time: revision.time,
          sections: new Map(readSections(source, md.parse(source, {})).map(({ id, content }) => [id, content]))
        }
      }))
    }

    const revisions = cache.get(path)!
    for (const section of sections) {
      let matching = 0
      while (revisions[matching]?.sections.get(section.id) === section.content) matching++

      if (matching === 0) {
        section.close.meta = { sectionUpdate: '小节有未提交的修改' }
      } else if (!shallow || matching < revisions.length) {
        section.close.meta = { sectionUpdate: revisions[matching - 1].time }
      }
    }
  })

  md.renderer.rules.heading_close = (tokens, index, options, _env, renderer) => {
    const closingTag = renderer.renderToken(tokens, index, options)
    const update = tokens[index].meta?.sectionUpdate
    if (typeof update === 'string') {
      return `<span class="section-update ignore-header">${update}</span>${closingTag}`
    }
    if (typeof update !== 'number') return closingTag

    const date = new Date(update)
    return `<time class="section-update ignore-header" datetime="${date.toISOString()}" title="北京时间">最后修改 ${localTime.format(date)}</time>${closingTag}`
  }
}
