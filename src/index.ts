// パッケージの "." から出すもの. エントリ (mount と <Desktop>) と, アプリケーションとの契約の型.
export type {
  AppContext,
  AppDeclaration,
  AppEntry,
  AppName,
  AppStart,
  InstanceId,
  MountOptions,
  OpenRequest,
  WindowId,
} from './view/app.ts';
export { mount } from './view/mount.tsx';
