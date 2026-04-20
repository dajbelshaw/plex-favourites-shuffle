use std::sync::{
    atomic::{AtomicI64, Ordering},
    Arc,
};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_positioner::{Position, WindowExt};

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();

            // Timestamp guard: ignore Focused(false) within 1500 ms of last show.
            let last_shown: Arc<AtomicI64> = Arc::new(AtomicI64::new(0));
            let last_shown_for_event = last_shown.clone();
            let win_for_event = win.clone();

            win.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let elapsed = now_ms() - last_shown_for_event.load(Ordering::Relaxed);
                    if elapsed < 1500 {
                        return;
                    }
                    let _ = win_for_event.hide();
                }
            });

            // Tray context menu (right-click)
            let reload =
                MenuItem::with_id(app, "reload", "Reload Favourites", true, None::<&str>)?;
            let settings =
                MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit =
                MenuItem::with_id(app, "quit", "Quit Heartflow", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&reload, &settings, &sep, &quit])?;

            let win_for_tray = win.clone();
            let last_shown_for_tray = last_shown.clone();

            let tray: TrayIcon = TrayIconBuilder::with_id("heartflow-tray")
                .icon(tauri::include_image!("icons/tray/heart.png"))
                .icon_as_template(true)
                .tooltip("Heartflow")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(move |_tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if win_for_tray.is_visible().unwrap_or(false) {
                            let _ = win_for_tray.hide();
                        } else {
                            last_shown_for_tray.store(now_ms(), Ordering::Relaxed);
                            let _ = win_for_tray.move_window(Position::TrayCenter);
                            let _ = win_for_tray.show();
                            let _ = win_for_tray.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "reload" => {
                        let _ = app.emit("heartflow://reload", ());
                    }
                    "settings" => {
                        let _ = app.emit("heartflow://settings", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Keep the tray handle alive for the entire app lifetime.
            app.manage(tray);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Heartflow");
}
