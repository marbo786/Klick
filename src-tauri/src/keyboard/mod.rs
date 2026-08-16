pub mod events;
pub mod mapper;
pub mod listener;
pub mod active_app;

use tauri::App;

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    listener::start_listener(handle);
    Ok(())
}
