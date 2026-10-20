fn main() {
    // wasm のスタックは既定で 1 MiB あり, 初期メモリがその分大きくなる.
    // セッションは深い再帰をしないので 64 KiB に絞る.
    if std::env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("wasm32") {
        println!("cargo::rustc-link-arg-cdylib=-zstack-size=65536");
    }
}
