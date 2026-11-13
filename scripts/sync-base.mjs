// 同步基底规则：从 AIsouler 发布源下载最新规则文件到 base/AIsouler_gkd.json5
// 该仓库已于 2026-02 停止维护，此脚本仅用于偶尔拉取一次，通常无需运行
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SOURCES = [
  'https://registry.npmmirror.com/@aisouler/gkd_subscription/latest/files/dist/AIsouler_gkd.json5',
  'https://raw.githubusercontent.com/AIsouler/GKD_subscription/main/dist/AIsouler_gkd.json5',
]

let text = ''
for (const url of SOURCES) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    text = await res.text()
    console.log(`已从 ${url} 下载`)
    break
  } catch (e) {
    console.warn(`下载失败 ${url}: ${e.message}`)
  }
}

if (!text) {
  console.error('所有下载源都失败，基底文件未更新')
  process.exit(1)
}

fs.writeFileSync(path.join(ROOT, 'base/AIsouler_gkd.json5'), text)
console.log(`基底已更新，${(text.length / 1024).toFixed(0)} KB。运行 npm run build 重新合并`)
