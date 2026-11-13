import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import JSON5 from 'json5'

const ROOT = path.resolve(import.meta.dirname, '..')
const readJson5 = (p) => JSON5.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const base = readJson5('base/AIsouler_gkd.json5')
const meta = readJson5('src/meta.json5')
const custom = readJson5('src/apps.json5')?.apps ?? []
const customGlobal = readJson5('src/globalGroups.json5')?.globalGroups ?? []

const errors = []
const warnings = []

/** 合并规则组：保留已有 key，新组从当前最大 key+1 开始分配，同名组视为重复 */
function mergeGroups(existing, incoming, ownerLabel, onAdd = () => {}) {
  const usedKeys = new Set(existing.map((g) => g.key))
  let nextKey = usedKeys.size ? Math.max(...usedKeys) + 1 : 0
  const names = new Set(existing.map((g) => `${g.name}`))
  for (const raw of incoming) {
    if (typeof raw === 'string') {
      errors.push(`${ownerLabel}: 规则组不能是字符串，必须是对象`)
      continue
    }
    if (!raw.name) {
      errors.push(`${ownerLabel}: 存在缺少 name 的规则组`)
      continue
    }
    if (!raw.rules || (Array.isArray(raw.rules) && raw.rules.length === 0)) {
      errors.push(`${ownerLabel}/${raw.name}: rules 为空`)
      continue
    }
    if (names.has(raw.name)) {
      warnings.push(`${ownerLabel}/${raw.name}: 同名规则组已存在，已跳过`)
      continue
    }
    const key = raw.key !== undefined && !usedKeys.has(raw.key) ? raw.key : nextKey
    usedKeys.add(key)
    while (usedKeys.has(nextKey)) nextKey++
    names.add(raw.name)
    const group = { ...raw, key }
    existing.push(group)
    onAdd(group)
  }
  return existing
}

const apps = base.apps.map((app) => ({ ...app, groups: [...(app.groups ?? [])] }))
const appIndex = new Map(apps.map((app) => [app.id, app]))
const addedGroups = []

for (const app of custom) {
  if (!app.id) {
    errors.push('自定义应用缺少 id')
    continue
  }
  const target = appIndex.get(app.id)
  const collect = (g) => addedGroups.push({ app: app.id, name: g.name })
  if (target) {
    mergeGroups(target.groups, app.groups ?? [], app.id, collect)
  } else {
    const created = { id: app.id, name: app.name ?? app.id, groups: [] }
    mergeGroups(created.groups, app.groups ?? [], app.id, collect)
    if (!created.groups.length) {
      warnings.push(`${app.id}: 没有可用的规则组，已忽略该应用`)
      continue
    }
    apps.push(created)
    appIndex.set(app.id, created)
  }
}

if (!apps.length) errors.push('合并后没有任何应用规则')

const categories = [...base.categories]
for (const cat of meta.extraCategories ?? []) {
  if (categories.some((c) => c.name === cat.name)) continue
  categories.push({ key: Math.max(0, ...categories.map((c) => c.key)) + 1, enable: false, ...cat })
}
const categoryNames = new Set(categories.map((c) => c.name))
for (const { app, name } of addedGroups) {
  if (!name.includes('-')) {
    errors.push(`${app}/${name}: 规则组名缺少「类别-说明」格式，无法归类`)
    continue
  }
  const prefix = name.slice(0, name.indexOf('-'))
  if (!categoryNames.has(prefix)) {
    errors.push(`${app}/${name}: 类别「${prefix}」不在 categories 中`)
  }
}

const globalGroups = mergeGroups([...(base.globalGroups ?? [])], customGlobal, 'global', (g) => {
  if (!g.name.includes('-') || !categoryNames.has(g.name.slice(0, g.name.indexOf('-')))) {
    errors.push(`global/${g.name}: 规则组名需以已有类别开头，如「开屏广告-说明」`)
  }
})

const owner = meta.owner
const repo = meta.repo
const branch = meta.branch ?? 'main'
// raw.githubusercontent.com 在国内网络经常不可达，主链路走 jsDelivr（每次推送后需 purge 缓存）
const updateUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/dist/gkd.json5`
const supportUri = meta.supportUri ?? `https://github.com/${owner}/${repo}/issues`

const payload = {
  apps,
  globalGroups,
  categories,
}
const hash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')

const stateFile = path.join(ROOT, 'dist/.build-state.json')
const prev = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null
const version = prev && prev.hash === hash ? prev.version : (prev?.version ?? 0) + 1

const subscription = {
  id: meta.id,
  name: meta.name,
  version,
  author: meta.author,
  updateUrl,
  checkUpdateUrl: './gkd.version.json5',
  supportUri,
  categories,
  globalGroups,
  apps,
}

if (errors.length) {
  console.error('构建失败：')
  for (const e of errors) console.error('  - ' + e)
  process.exit(1)
}

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true })
const outFile = path.join(ROOT, 'dist/gkd.json5')
const text = '// 本文件由 scripts/build.mjs 自动生成，请勿手动修改\n' + JSON.stringify(subscription)
fs.writeFileSync(outFile, text)
fs.writeFileSync(
  path.join(ROOT, 'dist/gkd.version.json5'),
  JSON.stringify({ id: subscription.id, version }),
)
fs.writeFileSync(stateFile, JSON.stringify({ hash, version }, null, 2) + '\n')

const groupCount = apps.reduce((sum, app) => sum + app.groups.length, 0)
console.log(
  `构建完成 v${version}：${apps.length} 应用 / ${groupCount} 规则组 / ${globalGroups.length} 全局组，` +
    `${(fs.statSync(outFile).size / 1024).toFixed(0)} KB`,
)
for (const w of warnings) console.warn('  提示: ' + w)
