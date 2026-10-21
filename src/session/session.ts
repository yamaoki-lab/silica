// セッションの wasm を包み, リクエストを送ってレスポンスを受け取る所と, イベントを配る所を持つ.
// wasm とのやり取りの形は session/src/entry.rs の注記の通り.
import * as pb from './gen/silica/session/v1alpha1/session.ts';

interface Exports {
  memory: WebAssembly.Memory;
  silica_request_buffer(length: number): number;
  silica_handle(): number;
  silica_output_buffer(): number;
}

export type SessionListener = (event: pb.Event) => void;

export class Session {
  readonly #exports: Exports;
  readonly #listeners = new Set<SessionListener>();
  readonly #queue: pb.Event[] = [];
  #dispatching = false;

  constructor(instance: WebAssembly.Instance) {
    this.#exports = instance.exports as unknown as Exports;
  }

  // リクエストを1つ送り, レスポンスを返す. その間に起きたイベントは, 返す前に購読している所へ配る.
  // 購読している所が中で send を呼んだ時は, そのイベントを今のイベントの後に配る (起きた順を保つ).
  send(request: pb.Request): pb.Response {
    const output = this.#call(request);
    this.#queue.push(...output.events);
    this.#dispatch();
    return output.response;
  }

  // イベントを購読する. 返した関数で止める.
  subscribe(listener: SessionListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #call(request: pb.Request): pb.Output & { response: pb.Response } {
    const exports = this.#exports;
    const bytes = pb.Request.encode(request).finish();
    const pointer = exports.silica_request_buffer(bytes.length);
    new Uint8Array(exports.memory.buffer, pointer, bytes.length).set(bytes);
    const length = exports.silica_handle();
    // 呼び出しの中でメモリが伸びると前の view は使えないので, 呼んだ後に作り, 次の呼び出しの前に写し取る.
    const output = pb.Output.decode(
      new Uint8Array(exports.memory.buffer, exports.silica_output_buffer(), length).slice(),
    );
    if (output.response === undefined) {
      throw new Error('セッションがリクエストのバイト列を読めなかった');
    }
    return { ...output, response: output.response };
  }

  #dispatch(): void {
    if (this.#dispatching) return;
    this.#dispatching = true;
    try {
      for (let event = this.#queue.shift(); event !== undefined; event = this.#queue.shift()) {
        for (const listener of this.#listeners) {
          try {
            listener(event);
          } catch (error) {
            // 1つの購読先の誤りで, 他の購読先や後のイベントを止めない.
            queueMicrotask(() => {
              throw error;
            });
          }
        }
      }
    } finally {
      this.#dispatching = false;
    }
  }
}
