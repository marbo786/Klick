pub mod active_app;
pub mod events;
pub mod listener;
pub mod mapper;

use tauri::App;

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let handle = app.handle().clone();
    listener::start_listener(handle);
    Ok(())
}
