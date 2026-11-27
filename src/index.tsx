import { messages } from "./i18n";
import { form } from "./form";
import { definePlugin } from "@tau/plugins";
import { createOssSyncProvider } from "./sync";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

export default definePlugin({
  ...__PLUGIN_META__,
  i18n: messages,
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
