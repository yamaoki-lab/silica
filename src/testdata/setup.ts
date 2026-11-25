// 各ブラウザテストファイルの前に実行される.
import { commands } from 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    limitNetwork: (hosts?: string[]) => Promise<void>;
  }
}

await commands.limitNetwork();
