//! アプリケーションとウインドウの状態のうち, OS から見えない側 (セッション).
//! ページからは wasm で読み, シェルからは C ABI の共有ライブラリで読む.

// std の panic の処理は文字列の整形を引き込み, wasm を大きくする. wasm 向けは core と alloc だけで書く.
#![cfg_attr(target_arch = "wasm32", no_std)]

// 既定のアロケータ (dlmalloc) より小さい.
#[cfg(all(target_arch = "wasm32", not(target_feature = "atomics")))]
#[global_allocator]
static TALC: talc::wasm::WasmDynamicTalc = talc::wasm::new_wasm_dynamic_allocator();

// panic = "abort" なので, 止めるだけで何も出さない.
#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}
