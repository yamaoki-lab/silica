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

/// proto/silica/session/v1alpha1/session.proto から生成した型.
// 生成したコードには clippy をかけない.
#[allow(clippy::all)]
pub mod proto {
    include!(concat!(env!("OUT_DIR"), "/silica.session.v1alpha1.rs"));
    #[cfg(test)]
    include!(concat!(
        env!("OUT_DIR"),
        "/silica.session.v1alpha1.serde.rs"
    ));
}

#[cfg(test)]
mod tests {
    use super::proto::{ListWindows, Request, request};
    use prost::Message as _;

    #[test]
    fn scenario_json_request_round_trips_through_bytes() {
        let request: Request = serde_json::from_str(r#"{ "listWindows": {} }"#).unwrap();
        assert_eq!(
            request.body,
            Some(request::Body::ListWindows(ListWindows::default()))
        );
        let decoded = Request::decode(request.encode_to_vec().as_slice()).unwrap();
        assert_eq!(decoded, request);
    }
}
