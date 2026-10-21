//! ページ (wasm) とシェル (C ABI) から呼ぶエントリ. protobuf のバイト列を受けてバイト列を返す.
//!
//! 呼ぶ側は silica_request_buffer で受け口を得てリクエストを書き, silica_handle を呼び,
//! silica_output_buffer から silica_handle が返した長さだけ出力 (Output) を読む.
//! wasm のメモリは呼び出しの中で伸びることがあるので, 読み書きの前にメモリの view を作り直す.
//! どのエントリも1つのスレッドからだけ呼ぶ.

use alloc::vec::Vec;
use core::cell::UnsafeCell;

use prost::Message as _;

use crate::Session;
use crate::proto::Request;

struct Global {
    session: Session,
    request: Vec<u8>,
    output: Vec<u8>,
}

struct GlobalCell(UnsafeCell<Global>);

// SAFETY: エントリは1つのスレッドからだけ呼ぶ (モジュールの注記).
unsafe impl Sync for GlobalCell {}

static GLOBAL: GlobalCell = GlobalCell(UnsafeCell::new(Global {
    session: Session::new(),
    request: Vec::new(),
    output: Vec::new(),
}));

fn global() -> &'static mut Global {
    // SAFETY: 1つのスレッドからだけ呼び, エントリどうしは呼び合わないので, 参照は同時に1つしかできない.
    unsafe { &mut *GLOBAL.0.get() }
}

/// リクエストを書く受け口を len バイトにして, 先頭を返す.
#[unsafe(no_mangle)]
pub extern "C" fn silica_request_buffer(len: usize) -> *mut u8 {
    let request = &mut global().request;
    request.clear();
    request.resize(len, 0);
    request.as_mut_ptr()
}

/// 受け口のリクエストを処理し, 出力の長さを返す.
/// 読めないバイト列には, 長さ 0 (レスポンスの無い出力) を返す. ラッパーの誤りなので, レスポンスでは表さない.
#[unsafe(no_mangle)]
pub extern "C" fn silica_handle() -> usize {
    let global = global();
    global.output = match Request::decode(global.request.as_slice()) {
        Ok(request) => global.session.handle(request).encode_to_vec(),
        Err(_) => Vec::new(),
    };
    global.output.len()
}

/// 最後の silica_handle の出力の先頭を返す.
#[unsafe(no_mangle)]
pub extern "C" fn silica_output_buffer() -> *const u8 {
    global().output.as_ptr()
}
