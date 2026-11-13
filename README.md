# 个人 GKD 订阅

以 [AIsouler/GKD_subscription](https://github.com/AIsouler/GKD_subscription)（已于 2026-02 停止维护）的规则为基底，
叠加自己的自定义规则，构建为单个订阅文件。规则格式遵循 [GKD 订阅文档](https://gkd.li/guide/subscription)。

## 订阅链接

在 GKD 的「订阅 → 添加」中填入（ghfast 镜像，实时回源，国内可直连）：

```txt
https://ghfast.top/https://raw.githubusercontent.com/jklw4/gkd-subscription/main/dist/gkd.json5
```

备选（镜像失效时换用，jsDelivr 分支内容有约 12 小时缓存）：

```txt
https://cdn.jsdelivr.net/gh/jklw4/gkd-subscription@main/dist/gkd.json5
https://gh-proxy.com/https://raw.githubusercontent.com/jklw4/gkd-subscription/main/dist/gkd.json5
https://raw.githubusercontent.com/jklw4/gkd-subscription/main/dist/gkd.json5
```

> 订阅文件里的 `updateUrl` / `checkUpdateUrl` 也指向 ghfast 镜像，推送后手机下拉即可检测到新版本，无需刷 CDN 缓存。
> 若镜像地址失效，改 `src/meta.json5` 的 `mirror` 后重新 build 推送即可。

当前内容：886 个应用 / 2074 个规则组（基底）+ 自定义规则 / 3 个全局规则组。

> 基底规则与 AIsouler 一致，默认只开启「开屏广告」类别。其它类别（全屏广告、局部广告、更新提示、评价提示等）
> 需要在 GKD「订阅 → 规则类别」里按需手动开启。开启越多越耗电，建议只开常用的。

## 目录结构

```txt
base/AIsouler_gkd.json5   基底规则（同步自 AIsouler，正常不需要改动）
src/meta.json5            订阅元信息：id、名称、仓库地址、额外类别
src/apps.json5            自定义应用规则（日常加规则只改这里）
src/globalGroups.json5    自定义全局规则组（对所有应用生效，慎用）
scripts/build.mjs         合并基底与自定义规则，产出 dist 并自增 version
scripts/sync-base.mjs     重新拉取基底规则（基底已停更，一般用不到）
dist/gkd.json5            构建产物，GKD 实际下载的订阅文件
dist/gkd.version.json5    更新检测用的精简文件
dist/.build-state.json    内容哈希与版本号，保证内容不变时 version 不涨
```

## 日常流程：快照 → 规则 → 发布

1. 把 GKD 抓取的快照发给我（快照链接 `https://i.gkd.li/i/xxxx` 或导出的 zip 均可）。
2. 我在 `src/apps.json5` 中补充规则组，命名必须是「类别-说明」格式，例如 `开屏广告-开屏跳过`。
3. 运行 `npm run build`（内容有变化时 version 自动 +1）。
4. 提交并推送 `src/`、`dist/` 的变更。
5. 手机 GKD「订阅」页下拉刷新，检测到新版本即自动更新。

新增应用的写法：

```json5
{
  apps: [
    {
      id: 'com.example.app',
      name: '示例应用',
      groups: [
        {
          name: '开屏广告-跳过按钮',
          matchTime: 10000,
          actionMaximum: 1,
          resetMatch: 'app',
          rules: '[text*="跳过"][text.length<10][visibleToUser=true]',
          snapshotUrls: 'https://i.gkd.li/i/12345678',
        },
      ],
    },
  ],
}
```

已有基底应用补充规则时，只需写 `id` + `groups`，构建脚本会自动追加并分配不冲突的 `key`；
同名规则组会被跳过（避免与基底重复）。

## 规则编写要点

- 选择器：优先用 `vid`/`id`（带 `@` 前缀表示以该节点为触发点），无有效属性时用邻近节点定位，例如 `@[vid="iv_close"] - [vid="rl_ad"][visibleToUser=true]`。
- 开屏类通常配 `matchTime: 10000`、`actionMaximum: 1`、`resetMatch: 'app'`，并加 `fastQuery: true`。
- 尽量加 `[visibleToUser=true]`，避免误点不可见节点。
- 必须带 `snapshotUrls`（快照链接），便于后续排查失效规则。
- 跳过类规则确认「点击」还是「关闭」：必要时用 `action: 'clickCenter'` / `action: 'click'` 或 `position` 指定节点。

## 版本与更新机制

`dist/gkd.json5` 的 `version` 由构建脚本维护：规则内容（应用、规则组、类别）哈希与上次一致时保持不变，
有变化则自增。GKD 仅在 `version` 变大时更新，所以**改完规则一定要重新 build 再推送**。

`id` 固定为 `20261113`，不要修改，否则 GKD 会认为是一个新订阅。

## 来源与声明

- 规则基底来自 [AIsouler/GKD_subscription](https://github.com/AIsouler/GKD_subscription)，其声明「禁止在国内平台传播 / 仅供本人学习使用」，
  本仓库仅为个人自用，规则版权归原作者。
- 规则格式与选择器语法参考 [GKD 官方文档](https://gkd.li/)。
