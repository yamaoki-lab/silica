use protox::prost::Message as _;

fn main() {
    // wasm のスタックは既定で 1 MiB あり, 初期メモリがその分大きくなる.
    // セッションは深い再帰をしないので 64 KiB に絞る.
    if std::env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("wasm32") {
        println!("cargo::rustc-link-arg-cdylib=-zstack-size=65536");
    }

    // .proto から Rust の型を作る. protox で読むので protoc は要らない.
    println!("cargo::rerun-if-changed=../proto");
    let files = protox::compile(["silica/session/v1alpha1/session.proto"], ["../proto"]).unwrap();
    prost_build::Config::new()
        .compile_fds(files.clone())
        .unwrap();

    // テストでシナリオの JSON を読むための serde の実装. テストの時だけ取り込む.
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    pbjson_build::Builder::new()
        .register_descriptors(&files.encode_to_vec())
        .unwrap()
        .out_dir(&out)
        .build(&[".silica"])
        .unwrap();
}
