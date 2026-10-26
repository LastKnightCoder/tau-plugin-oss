import { definePlugin, type ProviderForm } from "@tau/plugins";
import { createOssSyncProvider } from "./sync";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

const form: ProviderForm = {
  groups: [
    {
      title: "账号",
      description: "在阿里云控制台的 AccessKey 管理中获取",
      fields: [
        { key: "accessKeyId", label: "AccessKey ID", type: "text" },
        { key: "accessKeySecret", label: "AccessKey Secret", type: "secret" },
      ],
    },
    {
      title: "存储位置",
      fields: [
        { key: "bucket", label: "Bucket", type: "text", summary: true },
        {
          key: "region",
          label: "区域",
          type: "text",
          placeholder: "oss-cn-hangzhou",
          summary: true,
        },
        {
          key: "path",
          label: "目录",
          type: "text",
          optional: true,
          description: "留空表示根目录",
          placeholder: "sync",
        },
      ],
    },
  ],
};

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.sync.register({
        id: context.pluginId,
        name: "阿里云 OSS",
        create: config => createOssSyncProvider(config, context.fetch),
      });
      context.settings.register({ id: "sync", title: "阿里云 OSS", target: "sync", form });
    },
  }),
});
