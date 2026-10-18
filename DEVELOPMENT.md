# 开发说明

需要Node.js 22及以上、pnpm 11.9.0。使用公开SDK0.10.0和UI契约0.1.1，不依赖Tau源码、本地SDK快照或宿主node_modules。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

输出dist/tau.sync-oss-0.1.0.zip。src/index.tsx注册配置表单和五方法提供方；src/sync.ts是普通渲染模块，由main.js导入。没有Node后台入口。

使用ali-oss6.23.0的官方浏览器构建。上传、列举、桶版本检查由SDK处理；浏览器版没有Node的get/head，因此GET/HEAD使用公开signatureUrl API。SDK支持HEAD签名，但当前类型声明遗漏HEAD，signedUrl中仅补齐这项类型范围。所有传输通过context.fetch，transport.ts只适配SDK的HTTP请求/响应形状，不实现OSS签名或同步引擎。

测试使用官方浏览器SDK和本机HTTP服务。测试中的Endpoint替换仅用于隔离测试，不是生产配置字段；真实Electron验收由宿主项目的sync-storage脚本执行，并独立核验签名。真实凭据不得写入源码、日志或测试。

普通上传为直接PUT；createFileIfAbsent保留桶版本控制检查与x-oss-forbid-overwrite:true。修改存储行为时必须覆盖签名读取、权限失败、并发条件创建、分页及恢复，不修改客户端冲突协议。
