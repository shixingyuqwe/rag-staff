/// <reference types="@rsbuild/core/types" />

interface ImportMetaEnv {
  readonly PUBLIC_PATH: string;
  readonly PUBLIC_WECOM_AUTH_BASE: string;
  readonly PUBLIC_WECOM_CORP_ID: string;
  readonly PUBLIC_MF_API_BASE: string;
  readonly PUBLIC_MF_API_TOKEN: string;
  readonly PUBLIC_MF_SCORING_AGENT_SN: string;
  readonly PUBLIC_MF_SCORING_VERSION_SN: string;
  readonly PUBLIC_MF_LOG_AGENT_SN: string;
  readonly PUBLIC_MF_LOG_VERSION_SN: string;
  readonly PUBLIC_RAG_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css' {
  const content: any;
  export default content;
}

declare module '*.svg' {
  import type React from 'react';
  export const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >;
  const src: string;
  export default src;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module '*.ico' {
  const content: string;
  export default content;
}
