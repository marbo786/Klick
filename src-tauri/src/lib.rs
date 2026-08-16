mod keyboard;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
    .setup(|app| {
      keyboard::init(app)?;
      
      let args: Vec<String> = std::env::args().collect();
      if args.iter().any(|a| a == "--minimized") {
          if let Some(window) = app.get_webview_window("main") {
              let _ = window.hide();
          }
      }

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Build Tray Menu
      let toggle_i = MenuItemBuilder::with_id("toggle", "Show / Hide").build(app)?;
      let quit_i = MenuItemBuilder::with_id("quit", "Quit Klick").build(app)?;
      let menu = MenuBuilder::new(app)
          .items(&[&toggle_i, &quit_i])
          .build()?;

      // Build Tray
      let _tray = TrayIconBuilder::new()
          .menu(&menu)
          .on_menu_event(|app, event| match event.id().as_ref() {
              "quit" => app.exit(0),
              "toggle" => {
                  if let Some(window) = app.get_webview_window("main") {
                      let is_visible = window.is_visible().unwrap_or(false);
                      if is_visible {
                          let _ = window.hide();
                      } else {
                          let _ = window.show();
                          let _ = window.set_focus();
                      }
                  }
              }
              _ => {}
          })
          .on_tray_icon_event(|tray, event| match event {
              TrayIconEvent::Click {
                  button: MouseButton::Left,
                  button_state: MouseButtonState::Up,
                  ..
              } => {
                  if let Some(window) = tray.app_handle().get_webview_window("main") {
                      let is_visible = window.is_visible().unwrap_or(false);
                      if is_visible {
                          let _ = window.hide();
                      } else {
                          let _ = window.show();
                          let _ = window.set_focus();
                      }
                  }
              }
              _ => {}
          })
          .icon(app.default_window_icon().cloned().unwrap())
          .build(app)?;

      Ok(())
    })
    .on_window_event(|window, event| match event {
        tauri::WindowEvent::CloseRequested { api, .. } => {
            let _ = window.hide();
            api.prevent_close();
        }
        _ => {}
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
