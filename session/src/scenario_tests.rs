//! testdata/scenarios/ のシナリオを流す. 同じファイルを vitest でも wasm を通して流す.
//! 1つのシナリオは新しいセッションで始め, 手順ごとにリクエストを送って, レスポンスとイベントを比べる.

use std::fs;
use std::path::Path;

use prost::Message as _;
use serde::Deserialize;

use crate::Session;
use crate::proto::{Event, Output, Request, Response};

#[derive(Deserialize)]
struct Scenario {
    name: String,
    steps: Vec<Step>,
}

#[derive(Deserialize)]
struct Step {
    request: Request,
    response: Response,
    /// 省くとイベントが起きないこと.
    #[serde(default)]
    events: Vec<Event>,
}

#[test]
fn scenarios() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("testdata/scenarios");
    let mut paths: Vec<_> = fs::read_dir(&dir)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .filter(|path| path.extension().is_some_and(|e| e == "json"))
        .collect();
    paths.sort();
    assert!(!paths.is_empty(), "{} にシナリオが無い", dir.display());

    let mut failures = Vec::new();
    for path in &paths {
        let file = path.file_name().unwrap().to_string_lossy();
        let scenarios: Vec<Scenario> =
            serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap();
        for scenario in scenarios {
            let mut session = Session::new();
            for (i, step) in scenario.steps.into_iter().enumerate() {
                // wasm の境目と同じく, バイト列を通して渡し, 受け取る.
                let request = Request::decode(step.request.encode_to_vec().as_slice()).unwrap();
                let output = session.handle(request).encode_to_vec();
                let output = Output::decode(output.as_slice()).unwrap();
                let expected = Output {
                    response: Some(step.response),
                    events: step.events,
                };
                if output != expected {
                    failures.push(format!(
                        "{file} / {} / 手順 {}\n  期待: {expected:?}\n  結果: {output:?}",
                        scenario.name,
                        i + 1
                    ));
                    break;
                }
            }
        }
    }
    assert!(failures.is_empty(), "\n{}", failures.join("\n"));
}
