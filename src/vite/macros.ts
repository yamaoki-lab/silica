// S2 の style マクロのプラグイン (unplugin-parcel-macros) を, node_modules の中の silica にも効かせる.
// 元のプラグインは node_modules の中のファイルを決め打ちで飛ばし, 設定では変えられない.
// silica はソースのまま配るので, そのままでは使う側のビルドが silica のソースで止まる (#9 の項目 10).
// そこでフックを取り出し, 変換の前の振り分けだけを変えたプラグインに載せ替える.
import macros from 'unplugin-parcel-macros';
import type { Plugin } from 'vite';

// 載せ替えるフック. 元のプラグインがこれ以外を持つようになったら, テストで気づけるようにする.
export const handledHooks = [
  'name',
  'enforce',
  'transformInclude',
  'transform',
  'resolveId',
  'loadInclude',
  'load',
  'watchChange',
] as const;

const NODE_MODULES = '/node_modules/';

// 元のプラグインと同じく, JS と TS のファイルだけを見る. node_modules の中は silica のファイルだけを通す.
// silica の依存を入れ子の node_modules に置くパッケージマネージャもあるので, 最後の node_modules の直下で見分ける.
export function isMacroTarget(id: string): boolean {
  if (!/\.(js|jsx|ts|tsx)$/.test(id)) return false;
  const at = id.lastIndexOf(NODE_MODULES);
  return at === -1 || id.startsWith('silica/', at + NODE_MODULES.length);
}

export function silicaMacros(): Plugin[] {
  // unplugin が Vite 向けにするのは, transformInclude と loadInclude を前の振り分けにすることだけ.
  // 同じことを, transformInclude を isMacroTarget に替えて行う.
  // フックは unplugin の文脈の型で書かれているが, Vite の文脈で呼ばれる前提のものなので, そのまま this を渡す.
  return [macros.raw(undefined, { framework: 'vite' })].flat().map(
    ({ name, enforce, transform, resolveId, loadInclude, load, watchChange }): Plugin => ({
      name: `silica:${name}`,
      enforce,
      transform:
        transform &&
        function (code, id) {
          if (!isMacroTarget(id)) return null;
          return Reflect.apply(transform, this, [code, id]);
        },
      resolveId:
        resolveId &&
        function (...args) {
          return Reflect.apply(resolveId, this, args);
        },
      load:
        load &&
        function (id) {
          if (loadInclude && !loadInclude(id)) return null;
          return Reflect.apply(load, this, [id]);
        },
      watchChange:
        watchChange &&
        function (...args) {
          return Reflect.apply(watchChange, this, args);
        },
    }),
  );
}
