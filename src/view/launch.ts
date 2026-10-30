// mount のうち, ページの要素と描画に依らない所. セッションのイベントでストアを動かすことと, アプリケーションの起動を持つ.
import type { WindowStore } from '../agate/store.ts';
import type * as pb from '../session/gen/silica/session/v1alpha1/session.ts';
import type { Session } from '../session/index.ts';
import type { AppDeclaration, AppEntry, InstanceId, WindowId } from './app.ts';

let claimed = false;

// 1つのページで mount できるのは1回だけ. 2つ目を使う所が今は無く, 後で緩めても今の使い方は壊れない.
export function claimPage(): void {
  if (claimed) throw new Error('mount は1つのページで1回だけ呼べる');
  claimed = true;
}

export interface LaunchEntry {
  app: AppDeclaration;
  autostart: boolean;
}

export function toLaunchEntries(apps: readonly AppEntry[]): LaunchEntry[] {
  return apps.map((entry) =>
    'app' in entry ? { app: entry.app, autostart: entry.autostart ?? false } : { app: entry, autostart: false },
  );
}

// 登録のリクエストに載せる宣言. id の形の誤りと重複は, セッションが登録の時に断る.
export function toApplications(entries: readonly LaunchEntry[]): pb.Application[] {
  return entries.map(({ app }) => ({ id: app.id, singleInstance: app.singleInstance ?? false }));
}

// セッションのイベントを見て, ストアにウインドウを追加し, 閉じたら消す. タイトルは titles に持つ.
// 開く位置をずらす単位はアプリケーションなので, インスタンスからアプリケーションを引く表も持つ.
export function followSession(session: Session, store: WindowStore<WindowId>, titles: Map<WindowId, string>): () => void {
  const applicationOf = new Map<number, string>();
  return session.subscribe(({ body }) => {
    switch (body?.$case) {
      case 'instanceCreated':
        applicationOf.set(body.value.instanceId, body.value.applicationId);
        break;
      case 'windowOpened': {
        const opened = body.value.window;
        if (opened === undefined) break;
        const id = opened.id as WindowId;
        titles.set(id, opened.title);
        store.open(id, applicationOf.get(opened.instanceId) ?? '');
        break;
      }
      case 'windowClosed': {
        const id = body.value.windowId as WindowId;
        titles.delete(id);
        store.close(id);
        break;
      }
    }
  });
}

// アプリケーションを起動する. 起動の失敗は mount の失敗にせず, そのアプリケーションのエラーとして扱う (今は report に渡すだけ).
export async function launch(
  session: Session,
  app: AppDeclaration,
  report: (message: string, error: unknown) => void = (message, error) => console.error(message, error),
): Promise<void> {
  try {
    const opened = session.send({
      body: { $case: 'openApplication', value: { applicationId: app.id, newInstance: false } },
    });
    if (opened.body?.$case !== 'openApplicationResult') {
      throw new Error(`セッションがアプリケーションを開かなかった (${opened.body?.$case ?? 'レスポンスが空'})`);
    }
    const instanceId = opened.body.value.instanceId as InstanceId;
    const { default: start } = await app.load();
    start({
      request: {},
      instanceId,
      openWindow: ({ title }) => {
        const response = session.send({
          body: { $case: 'openWindow', value: { instanceId, title, attributes: undefined } },
        });
        if (response.body?.$case !== 'openWindowResult') {
          throw new Error(`セッションがウインドウを開かなかった (${response.body?.$case ?? 'レスポンスが空'})`);
        }
        return response.body.value.windowId as WindowId;
      },
    });
  } catch (error) {
    report(`アプリケーション ${app.id} を起動できなかった`, error);
  }
}
