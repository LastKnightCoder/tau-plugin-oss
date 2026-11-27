import type { ProviderFormDeclaration } from "@tau/plugins";
import { messages } from "./i18n";

export const form: ProviderFormDeclaration = {
  groups: [
    {
      title: messages.ref("account.title"),
      description: messages.ref("account.description"),
      fields: [
        { key: "accessKeyId", label: messages.ref("account.accessKey"), type: "text" },
        { key: "accessKeySecret", label: messages.ref("account.secret"), type: "secret" },
      ],
    },
    {
      title: messages.ref("location.title"),
      fields: [
        { key: "bucket", label: messages.ref("location.bucket"), type: "text", summary: true },
        {
          key: "region",
          label: messages.ref("location.region"),
          type: "text",
          placeholder: "oss-cn-hangzhou",
          summary: true,
        },
        {
          key: "path",
          label: messages.ref("location.path"),
          type: "text",
          optional: true,
          description: messages.ref("location.pathHint"),
          placeholder: "sync",
        },
      ],
    },
  ],
};
