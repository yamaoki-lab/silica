// セッションの wasm を読んで立ち上げる. 段階と取得の進捗を外へ伝え, 読み込み中の表示に使えるようにする.
import * as pb from './gen/silica/session/v1alpha1/session.ts';
import { Session } from './session.ts';

// 取得 (fetch), コンパイル (compile), 立ち上げ (start) の順に進む.
export type LoadStage = 'fetch' | 'compile' | 'start';

export interface LoadProgress {
  stage: LoadStage;
  // 取得の時だけ. 読んだバイト数 (展開した後).
  loaded?: number;
  // 取得の時だけ. 全体のバイト数 (展開した後). 分からない時は省く.
  total?: number;
}

export interface LoadOptions {
  // 立ち上げの時に登録するアプリケーション.
  applications: pb.Application[];
  onProgress?: (progress: LoadProgress) => void;
  // 展開した後の wasm の大きさ. 圧縮して配ると Content-Length は圧縮後の大きさなので, 割合を出すにはこれを渡す.
  size?: number;
}

export async function loadSession(
  source: string | URL | Response | PromiseLike<Response>,
  options: LoadOptions,
): Promise<Session> {
  const report = options.onProgress ?? (() => {});

  report({ stage: 'fetch', loaded: 0, total: options.size });
  const response = await (typeof source === 'string' || source instanceof URL ? fetch(source) : source);
  if (!response.ok) {
    throw new Error(`セッションの wasm を取得できなかった (${response.status})`);
  }
  const total = options.size ?? uncompressedLength(response);
  const bytes = await readAll(response, (loaded) => report({ stage: 'fetch', loaded, total }));

  report({ stage: 'compile' });
  const module = await WebAssembly.compile(bytes);

  report({ stage: 'start' });
  const session = new Session(await WebAssembly.instantiate(module));
  const registered = session.send({
    body: { $case: 'registerApplications', value: { applications: options.applications } },
  });
  if (registered.body?.$case !== 'done') {
    throw new Error(`アプリケーションを登録できなかった (${describe(registered)})`);
  }
  return session;
}

// 圧縮していない時だけ, Content-Length が展開した後の大きさになる.
function uncompressedLength(response: Response): number | undefined {
  const encoding = response.headers.get('content-encoding');
  if (encoding !== null && encoding !== 'identity') return undefined;
  const length = Number(response.headers.get('content-length') ?? Number.NaN);
  return Number.isInteger(length) && length >= 0 ? length : undefined;
}

async function readAll(response: Response, onChunk: (loaded: number) => void): Promise<Uint8Array<ArrayBuffer>> {
  if (response.body === null) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onChunk(bytes.length);
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  const reader = response.body.getReader();
  for (let result = await reader.read(); !result.done; result = await reader.read()) {
    chunks.push(result.value);
    loaded += result.value.length;
    onChunk(loaded);
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function describe({ body }: pb.Response): string {
  if (body === undefined) return 'レスポンスが空';
  if (body.$case !== 'rejected') return body.$case;
  const { reason } = body.value;
  return Object.entries(pb.RejectReason).find(([, value]) => value === reason)?.[0] ?? String(reason);
}
