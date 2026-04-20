use std::sync::{Arc, Mutex};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_positioner::{Position, WindowExt};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            let win = app.get_webview_window("main").unwrap();

            // Guard against the spurious Focused(false) that fires when the window
            // is first shown and immediately loses focus before the user interacts.
            let just_shown: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
            let just_shown_for_event = just_shown.clone();
            let win_for_event = win.clone();

            win.on_window_event(move |event| {
                if let tauri::WindowEvent::Focused(false) = event {
                    let mut guard = just_shown_for_event.lock().unwrap();
                    if *guard {
                        *guard = false;
                        return;
                    }
                    drop(guard);
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
            let just_shown_for_tray = just_shown.clone();

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
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
                            // Set guard before show so the imminent Focused(false) is ignored
                            *just_shown_for_tray.lock().unwrap() = true;
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

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Heartflow");
}
