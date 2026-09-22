# 云端部署：Vercel + Neon

本项目参考 `E:/Projects/Portfolio Manager/docs/execution/cloud-deployment-strategy.md` 的部署结构；未读取或复用其他项目的任何密钥、数据库或云端资源。

## 当前项目

正式地址：https://loo-kingdom.vercel.app

GitHub：https://github.com/jkL970910/LooKingdom （main 推送触发 Vercel 部署）。Vercel 项目 loo-kingdom，Node.js 22，服务器位于 iad1。正式域名使用应用自己的双人口令登录，其他部署地址保留 Vercel 访问保护。生产环境配置与本地测试数据分离，部署令牌不注入应用环境。

## 所需配置

复制 `.env.example` 为 `.env.local`，把真实值只保存在本地或 Vercel 环境变量中，勿粘贴到聊天、提交到 Git 或放进 `NEXT_PUBLIC_` 变量。

| 变量 | 用途 |
| --- | --- |
| DATABASE_URL | 新建的、专用于 Loo 国的 PostgreSQL 数据库连接串；Neon 推荐使用带 pooler 的连接地址，并保留连接串的 SSL 参数 |
| SESSION_SECRET | 至少 32 个字符的随机会话签名密钥 |
| BLUE_ACCESS_CODE | 蓝 Loo 的独立登录口令，至少 6 个字符（按用户确认设置） |
| RED_ACCESS_CODE | 红 Loo 的独立登录口令，至少 6 个字符（按用户确认设置），与蓝方不同 |
| APP_ORIGIN | 最终 HTTPS 网站 origin，例如 `https://loo-kingdom.example.com`，没有末尾斜杠；用于同源请求校验 |
| LOO_TIMEZONE | 双方共享纪念日时区，默认 `America/Toronto`，也可在初次建库前设置 `Asia/Shanghai` |
| VERCEL_TOKEN | 如由代理通过 API / CLI 部署，提供 Vercel 部署令牌；应用运行本身不需要 |
| VERCEL_ORG_ID / VERCEL_PROJECT_ID | 可选，部署到已有的指定 Vercel 团队与项目时提供 |

时区会写入初始化的小窝记录；已有小窝不会因为环境变量变化而偷偷改变纪念日时区。

## 部署步骤

1. 新建 Loo 国专用的 Neon PostgreSQL 数据库，取得连接串。不使用其他应用的业务数据库。
2. 在 Vercel 导入此项目，框架选择 Next.js，构建命令 `npm run build`；Node.js 使用该 Next.js 版本支持的 22 LTS 或更新支持版本。
3. 配置应用需要的服务器环境变量（不包括 VERCEL_TOKEN、VERCEL_ORG_ID、VERCEL_PROJECT_ID 等部署工具变量）。不要开启 `LOO_LOCAL_DEMO`；Vercel 环境始终禁止本地文件模式。
4. 部署后设置准确的 `APP_ORIGIN`；若绑定新域名，随之更新并重新部署。预览域名若需独立验收，应使用隔离数据库和该预览地址的环境变量。
5. 首次登录自动创建 `loo_kingdom`、`loo_photos`、`loo_login_limits`、`loo_geocode_cache` 和 `loo_service_clock` 表。没有示例个人日记或卡片。
6. 两部手机分别使用蓝方/红方口令登录；更新状态，等待 8 秒内另一方同步；发送互动并查看收件箱。
7. 创建带照片日记、未来倒计时和时长卡；验收图片权限、45 → 30 分钟扣减、刷新后的持久性以及只能向对方发卡、持卡人申请、另一方接受。

## 实现与维护

会话为 HTTP-only、SameSite=Lax 的签名 Cookie，云端仅经 HTTPS 发送；30 天过期。更换 SESSION_SECRET 可以使旧会话全部失效。登录失败尝试由数据库按来源和身份限流。换口令后若要撤销已登录设备，请同时轮换 SESSION_SECRET。

共享状态位于单行 JSONB 中；写操作通过事务和 `SELECT ... FOR UPDATE` 串行化，每次核销的请求 ID 与记录一起提交。照片单独存于 BYTEA 表，返回时校验会话。该布局针对一对情侣，未来扩展多用户时应迁移为分表和租户权限。

不要把数据库 SSL 设置改成 `rejectUnauthorized: false`。保留连接供应商的证书验证设置。`pg` 连接池每实例最多 3 个连接，适配小型部署。

API 禁止共享缓存；客户端暂时失联时不把写操作伪装成保存成功。未上传成功的表单会保留输入，用户重试；卡券确认重试使用相同请求 ID。

上传会先在客户端压缩，服务端限制单图 2MB，以避开 Vercel Function 的请求体大小上限。依据：[Vercel Functions 限制](https://vercel.com/docs/functions/limitations)。会话实现采用异步 Cookie API，依据：[Next.js cookies 文档](https://nextjs.org/docs/app/api-reference/functions/cookies)。

建议开启数据库服务的备份功能。界面“导出文字记录”只导出 JSON，不打包照片。需要完整迁移时备份数据库全部表，尤其是共享记录和照片两张表。

## 菜谱与旅行服务

无需新增 AI 密钥。小红书仅读取允许公开访问的网页元数据、JSON-LD 与序列化笔记正文，支持 `xhslink.com` 分享短链，逐跳校验地址，不执行网页脚本。受限笔记进入人工补充流程。生产环境应使用真实公开笔记验收识别结果及登录限制提示。

默认地图为 OpenStreetMap 标准瓦片、地点搜索为 Nominatim。`GEOCODING_BASE_URL` 可切换兼容搜索服务，`NEXT_PUBLIC_MAP_TILE_URL` 可切换兼容 XYZ 瓦片地址；切换地图供应商时也需要在 `trip-map.tsx` 更新对应署名。瓦片地址为浏览器可见配置，不能放私密凭据。应用不读取设备 GPS。

搜索只在用户点击时发起，服务端带识别应用的 User-Agent、24 小时缓存、10 秒超时；本地串行化，PostgreSQL 事务 advisory lock 在多实例间串行化并限速。地理编码使用单独缓存表，不改变情侣记录版本。正常展示地图署名，不预取离线瓦片，使用允许发送来源的 Referrer-Policy。依据：[OSM 瓦片政策](https://operations.osmfoundation.org/policies/tiles/)、[Nominatim 政策](https://operations.osmfoundation.org/policies/nominatim/)。

验收新增功能：分别用两台手机加入想吃清单、调整顺序并标记做过；从未来旅行大事件跳转足迹地图，编辑路线后检查大事件同步；用过去日期标记完成，确认回顾统计变化。地图网络失败时仍能编辑文字和手动坐标。旧数据首次读取会补上菜谱/旅行字段并关联旧旅行大事件，不会编造地图坐标；下一次保存会持久化迁移后的结构。

## 手机通知

用户于 2026-09-22 明确允许保存主动订阅的设备信息，并通过 Apple / Google / Mozilla / Microsoft Web Push 服务发送互动类型、活动状态和心情。通知不包含自由输入留言、日记或照片。

生产环境配置 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY，私钥仅保留在服务端；公钥由登录后的 /api/push 返回。请勿随意轮换，否则旧设备需要重新订阅。首次访问订阅接口自动创建独立 loo_push_subscriptions 表。

入口：右上角头像 → 我们的小窝 → 让小心意来敲门 → 开启手机小心意。iPhone / iPad 需 iOS 16.4+，先用 Safari 添加到主屏幕，再从该入口打开应用并授权。每台设备单独开启和关闭；退出登录前会删除本设备订阅并取消浏览器订阅，删除失败时保留登录方便重试。

已成功提交的摸摸头、抱抱、戳一戳以及活动/心情变化会提醒对方的订阅设备；同一互动请求 ID 重试不重复发送，单改私密留言不推送。使用 Next after 在提交后发送；推送失败不撤销业务保存。404/410 的过期订阅自动清理。投递为尽力而为，受网络、手机权限与专注模式影响，不保证实时送达；当前不设置定时重试。

Service Worker 只处理通知展示与点击，不缓存私人页面或 API。点击通知回到小窝，已登录设备显示最新状态；会话过期时先登录。

参考：[Apple Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)、[web-push](https://www.npmjs.com/package/web-push)。
