//! セッションの状態と, リクエストの処理.

use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;

use crate::proto::{
    Application, BringWindowToFront, CloseWindow, Done, Event, ForwardedToInstance,
    FrontWindowChanged, InstanceCreated, ListWindows, OpenApplication, OpenApplicationResult,
    OpenWindow, OpenWindowResult, Output, RegisterApplications, RejectReason, Rejected, Request,
    Response, Unsupported, Window, WindowActivation, WindowAttributes, WindowClosed, WindowList,
    WindowModality, WindowOpened, event, request, response,
};

struct Instance {
    id: u32,
    application_id: String,
}

struct OpenedWindow {
    id: u32,
    instance_id: u32,
    title: String,
    attributes: WindowAttributes,
}

impl OpenedWindow {
    fn to_proto(&self) -> Window {
        Window {
            id: self.id,
            instance_id: self.instance_id,
            title: self.title.clone(),
            attributes: Some(self.attributes.clone()),
        }
    }

    /// 開いた時と, 前面のウインドウを閉じた時に, 自分から前面になるか.
    fn takes_front(&self) -> bool {
        self.attributes.activation() == WindowActivation::Unspecified
    }
}

/// アプリケーション, インスタンス, ウインドウの3段と, 前面のウインドウを持つ.
#[derive(Default)]
pub struct Session {
    applications: Vec<Application>,
    instances: Vec<Instance>,
    /// 開いているウインドウ. 最後に前面になった順で, 前面になったことの無いものは開いた順に後ろへ並ぶ.
    windows: Vec<OpenedWindow>,
    /// 0 は前面のウインドウが無いこと.
    front_window_id: u32,
    last_instance_id: u32,
    last_window_id: u32,
}

impl Session {
    /// エントリが static に置くので, const で作れるようにする.
    pub const fn new() -> Self {
        Self {
            applications: Vec::new(),
            instances: Vec::new(),
            windows: Vec::new(),
            front_window_id: 0,
            last_instance_id: 0,
            last_window_id: 0,
        }
    }

    /// リクエストを1つ処理し, レスポンスとその間に起きたイベントを返す.
    pub fn handle(&mut self, request: Request) -> Output {
        let mut events = Vec::new();
        let body = match request.body {
            Some(request::Body::ListWindows(r)) => Ok(self.list_windows(r)),
            Some(request::Body::RegisterApplications(r)) => self.register_applications(r),
            Some(request::Body::OpenApplication(r)) => self.open_application(r, &mut events),
            Some(request::Body::OpenWindow(r)) => self.open_window(r, &mut events),
            Some(request::Body::CloseWindow(r)) => self.close_window(r, &mut events),
            Some(request::Body::BringWindowToFront(r)) => {
                self.bring_window_to_front(r, &mut events)
            }
            // prost は知らない oneof を読み飛ばすので, セッションより新しいリクエストは body が空で届く.
            None => Ok(response::Body::Unsupported(Unsupported {})),
        };
        let body = body.unwrap_or_else(|reason| {
            response::Body::Rejected(Rejected {
                reason: reason.into(),
            })
        });
        Output {
            response: Some(Response { body: Some(body) }),
            events,
        }
    }

    fn list_windows(&self, request: ListWindows) -> response::Body {
        let windows = self
            .windows
            .iter()
            .filter(|w| request.include_excluded || !w.attributes.exclude_from_window_list)
            .map(OpenedWindow::to_proto)
            .collect();
        response::Body::WindowList(WindowList { windows })
    }

    fn register_applications(
        &mut self,
        request: RegisterApplications,
    ) -> Result<response::Body, RejectReason> {
        for (i, application) in request.applications.iter().enumerate() {
            if !is_valid_application_id(&application.id) {
                return Err(RejectReason::InvalidApplicationId);
            }
            let registered = self.applications.iter().any(|a| a.id == application.id);
            let repeated = request.applications[..i]
                .iter()
                .any(|a| a.id == application.id);
            if registered || repeated {
                return Err(RejectReason::DuplicateApplication);
            }
        }
        self.applications.extend(request.applications);
        Ok(response::Body::Done(Done {}))
    }

    fn open_application(
        &mut self,
        request: OpenApplication,
        events: &mut Vec<Event>,
    ) -> Result<response::Body, RejectReason> {
        let application = self
            .applications
            .iter()
            .find(|a| a.id == request.application_id)
            .ok_or(RejectReason::UnknownApplication)?;
        if (application.single_instance || !request.new_instance)
            && let Some(instance_id) = self.recent_instance_of(&request.application_id)
        {
            push(
                events,
                event::Body::ForwardedToInstance(ForwardedToInstance { instance_id }),
            );
            return Ok(opened_application(instance_id));
        }
        self.last_instance_id += 1;
        let instance_id = self.last_instance_id;
        self.instances.push(Instance {
            id: instance_id,
            application_id: request.application_id.clone(),
        });
        push(
            events,
            event::Body::InstanceCreated(InstanceCreated {
                instance_id,
                application_id: request.application_id,
            }),
        );
        Ok(opened_application(instance_id))
    }

    /// 渡す先のインスタンス. 最後に前面になったウインドウのインスタンスで, ウインドウが無ければ最初に作ったもの.
    fn recent_instance_of(&self, application_id: &str) -> Option<u32> {
        let is_of = |instance_id: u32| {
            self.instances
                .iter()
                .any(|i| i.id == instance_id && i.application_id == application_id)
        };
        self.windows
            .iter()
            .map(|w| w.instance_id)
            .find(|&id| is_of(id))
            .or_else(|| {
                self.instances
                    .iter()
                    .find(|i| i.application_id == application_id)
                    .map(|i| i.id)
            })
    }

    fn open_window(
        &mut self,
        request: OpenWindow,
        events: &mut Vec<Event>,
    ) -> Result<response::Body, RejectReason> {
        if !self.instances.iter().any(|i| i.id == request.instance_id) {
            return Err(RejectReason::UnknownInstance);
        }
        let attributes = request.attributes.unwrap_or_default();
        let parent_id = attributes.parent_window_id;
        if parent_id != 0 {
            let parent = self.window(parent_id).ok_or(RejectReason::InvalidParent)?;
            if parent.instance_id != request.instance_id {
                return Err(RejectReason::InvalidParent);
            }
        } else if attributes.modality() == WindowModality::Parent {
            return Err(RejectReason::InvalidParent);
        }
        self.last_window_id += 1;
        let window = OpenedWindow {
            id: self.last_window_id,
            instance_id: request.instance_id,
            title: request.title,
            attributes,
        };
        let window_id = window.id;
        let takes_front = window.takes_front();
        push(
            events,
            event::Body::WindowOpened(WindowOpened {
                window: Some(window.to_proto()),
            }),
        );
        self.windows.push(window);
        if takes_front && !self.is_blocked(window_id) {
            self.set_front(window_id, events);
        }
        Ok(response::Body::OpenWindowResult(OpenWindowResult {
            window_id,
        }))
    }

    fn close_window(
        &mut self,
        request: CloseWindow,
        events: &mut Vec<Event>,
    ) -> Result<response::Body, RejectReason> {
        if self.window(request.window_id).is_none() {
            return Err(RejectReason::UnknownWindow);
        }
        // 親から順に子孫を集め, 逆の順 (子から先) に閉じる.
        let mut closing = vec![request.window_id];
        let mut i = 0;
        while i < closing.len() {
            let parent_id = closing[i];
            closing.extend(
                self.windows
                    .iter()
                    .filter(|w| w.attributes.parent_window_id == parent_id)
                    .map(|w| w.id),
            );
            i += 1;
        }
        for &window_id in closing.iter().rev() {
            self.windows.retain(|w| w.id != window_id);
            push(
                events,
                event::Body::WindowClosed(WindowClosed { window_id }),
            );
        }
        if closing.contains(&self.front_window_id) {
            let next = self
                .windows
                .iter()
                .find(|w| w.takes_front() && !self.is_blocked(w.id))
                .map_or(0, |w| w.id);
            self.set_front(next, events);
        }
        Ok(response::Body::Done(Done {}))
    }

    fn bring_window_to_front(
        &mut self,
        request: BringWindowToFront,
        events: &mut Vec<Event>,
    ) -> Result<response::Body, RejectReason> {
        let window = self
            .window(request.window_id)
            .ok_or(RejectReason::UnknownWindow)?;
        if window.attributes.activation() == WindowActivation::Never {
            return Err(RejectReason::NotActivatable);
        }
        if self.is_blocked(request.window_id) {
            return Err(RejectReason::BlockedByModal);
        }
        self.set_front(request.window_id, events);
        Ok(response::Body::Done(Done {}))
    }

    /// 前面のウインドウを替え, 一覧の先頭へ動かす. 替わらなければイベントを出さない.
    fn set_front(&mut self, window_id: u32, events: &mut Vec<Event>) {
        if window_id == self.front_window_id {
            return;
        }
        if let Some(i) = self.windows.iter().position(|w| w.id == window_id) {
            let window = self.windows.remove(i);
            self.windows.insert(0, window);
        }
        self.front_window_id = window_id;
        push(
            events,
            event::Body::FrontWindowChanged(FrontWindowChanged { window_id }),
        );
    }

    /// 開いているモーダルのウインドウが, このウインドウを前面にすることを止めているか.
    fn is_blocked(&self, window_id: u32) -> bool {
        let Some(window) = self.window(window_id) else {
            return false;
        };
        self.windows
            .iter()
            .any(|modal| match modal.attributes.modality() {
                WindowModality::Unspecified => false,
                WindowModality::Parent => modal.attributes.parent_window_id == window_id,
                WindowModality::Application => {
                    modal.instance_id == window.instance_id
                        && modal.id != window_id
                        && !self.is_descendant(window_id, modal.id)
                }
            })
    }

    fn is_descendant(&self, window_id: u32, ancestor_id: u32) -> bool {
        let mut current = window_id;
        while let Some(window) = self.window(current) {
            let parent_id = window.attributes.parent_window_id;
            if parent_id == ancestor_id {
                return true;
            }
            current = parent_id;
        }
        false
    }

    fn window(&self, window_id: u32) -> Option<&OpenedWindow> {
        self.windows.iter().find(|w| w.id == window_id)
    }
}

/// ドットで区切った2段以上で, 各段は空でなく, 使える文字は小文字の a-z, 0-9, - (#9 の項目 2).
fn is_valid_application_id(id: &str) -> bool {
    // split と all で書くと, 反復子の分だけ wasm が大きくなるので, バイトを1回なめる.
    let mut segments = 1;
    let mut segment_len = 0;
    for b in id.bytes() {
        if b == b'.' {
            if segment_len == 0 {
                return false;
            }
            segments += 1;
            segment_len = 0;
        } else if b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' {
            segment_len += 1;
        } else {
            return false;
        }
    }
    segments >= 2 && segment_len > 0
}

fn opened_application(instance_id: u32) -> response::Body {
    response::Body::OpenApplicationResult(OpenApplicationResult { instance_id })
}

fn push(events: &mut Vec<Event>, body: event::Body) {
    events.push(Event { body: Some(body) });
}
