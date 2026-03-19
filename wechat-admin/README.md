# Web 管理端原型

这个目录提供了一套可独立部署的静态 Web 管理端，用来承接小程序个人中心里的 `WEB管理端` 链接。

## 当前能力

- 优先按 `token` 加载 `data/<token>.json`
- 如果你配置了 `config.js` 里的 `apiBaseUrl`，会优先请求远端接口
- 如果静态 JSON 和接口都不可用，会自动回退到演示快照
- 支持文章筛选、分组查看、关注池查看、会员状态展示、导出与解析记录概览

## 本地预览

1. 直接打开 [index.html](/Users/feilei/Documents/微信小程序/web-admin/index.html)
2. 或者把整个 `web-admin` 目录交给任意静态服务器托管
3. 默认演示 token 已经内置在 [data/Prp5DUuwzbvl5yMhDUw9y0QtUJUq70ap.json](/Users/feilei/Documents/微信小程序/web-admin/data/Prp5DUuwzbvl5yMhDUw9y0QtUJUq70ap.json)

## 配置方式

看 [config.js](/Users/feilei/Documents/微信小程序/web-admin/config.js)：

- `apiBaseUrl`: 真实接口地址，例如 `https://api.example.com/web-admin/snapshot`
- `dataBaseUrl`: 静态 JSON 目录，默认是 `./data`
- `requestTimeoutMs`: Web 端拉取超时

## 小程序链接怎么配

建议把 [config/runtime.js](/Users/feilei/Documents/微信小程序/config/runtime.js) 里的 `WEB_ADMIN_BASE_URL` 配成以下两种之一：

- 路径模式：`https://blog.tianfeiyu.com/wechat-admin`
- 占位符模式：`https://blog.tianfeiyu.com/wechat-admin/index.html?token={token}`

如果你的静态托管没有做路由回退，优先用占位符模式，会更稳。

## 接真服务

- 静态 JSON 方案：发布 `web-admin` 目录时一并发布 `data/<token>.json`
- 接口方案：把 `apiBaseUrl` 指到你自己的 HTTP 服务，由它按 token 返回 `snapshot`
- 云函数这边已经补了 `getWebAdminSnapshot` 动作，可以作为后端取数骨架
