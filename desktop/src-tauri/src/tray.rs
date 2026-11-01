//! Ícono en la bandeja del sistema: las sesiones recientes a un clic, como la barra de menús de Mac.

use serde::Deserialize;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Wry};

const ID: &str = "main";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayContent {
    pub enabled: bool,
    pub recent_title: String,
    pub search: String,
    /// «Nueva sesión…»; opcional para que una interfaz antigua no rompa la bandeja.
    #[serde(default)]
    pub new_session: Option<String>,
    pub open: String,
    pub quit: String,
    pub recent: Vec<TrayItem>,
}

#[derive(Deserialize)]
pub struct TrayItem {
    pub id: String,
    pub title: String,
}

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    TrayIconBuilder::with_id(ID)
        .icon(app.default_window_icon().cloned().expect("ícono de la app"))
        .tooltip("Lost & Prompt")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            match id {
                "open" => show_main(app),
                "search" => {
                    show_main(app);
                    let _ = app.emit("quick-open", ());
                }
                "new-session" => {
                    show_main(app);
                    let _ = app.emit("new-session", ());
                }
                "quit" => app.exit(0),
                _ => {
                    if let Some(session) = id.strip_prefix("resume:") {
                        let _ = app.emit("tray-resume", session.to_owned());
                    }
                }
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

pub fn update(app: &AppHandle, content: &TrayContent) -> tauri::Result<()> {
    let Some(tray) = app.tray_by_id(ID) else { return Ok(()) };
    tray.set_visible(content.enabled)?;
    tray.set_menu(Some(menu(app, content)?))?;
    Ok(())
}

fn menu(app: &AppHandle, content: &TrayContent) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;
    if !content.recent.is_empty() {
        menu.append(&MenuItem::with_id(app, "recent", &content.recent_title, false, None::<&str>)?)?;
        for item in content.recent.iter().take(8) {
            let title: String = if item.title.chars().count() > 48 {
                item.title.chars().take(47).collect::<String>() + "…"
            } else {
                item.title.clone()
            };
            menu.append(&MenuItem::with_id(app, format!("resume:{}", item.id), title, true, None::<&str>)?)?;
        }
        menu.append(&PredefinedMenuItem::separator(app)?)?;
    }
    menu.append(&MenuItem::with_id(app, "search", &content.search, true, Some("CmdOrCtrl+Alt+K"))?)?;
    if let Some(label) = &content.new_session {
        menu.append(&MenuItem::with_id(app, "new-session", label, true, None::<&str>)?)?;
    }
    menu.append(&MenuItem::with_id(app, "open", &content.open, true, None::<&str>)?)?;
    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&MenuItem::with_id(app, "quit", &content.quit, true, None::<&str>)?)?;
    Ok(menu)
}

pub fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
