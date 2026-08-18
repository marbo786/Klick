use crate::keyboard::active_app::get_active_app_name;
use crate::keyboard::events::KeyboardEventPayload;
use crate::keyboard::mapper::map_key;
use rdev::{listen, Event, EventType};
use std::collections::HashSet;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};

pub fn start_listener(app_handle: AppHandle) {
    std::thread::spawn(move || {
        // Track held keys to determine 'repeat' status
        let held_keys = Arc::new(Mutex::new(HashSet::new()));

        let callback = move |event: Event| {
            let timestamp = match SystemTime::now().duration_since(UNIX_EPOCH) {
                Ok(n) => n.as_secs_f64() * 1000.0,
                Err(_) => 0.0,
            };

            match event.event_type {
                EventType::KeyPress(key) => {
                    let key_id = map_key(key);
                    if key_id == "Unknown" {
                        return;
                    }
                    println!("Rust captured KeyPress: {}", key_id);

                    let repeat = {
                        let mut keys = held_keys.lock().unwrap();
                        if keys.contains(&key_id) {
                            true
                        } else {
                            keys.insert(key_id.clone());
                            false
                        }
                    };

                    let active_app = get_active_app_name();

                    let payload = KeyboardEventPayload {
                        event: "keydown".to_string(),
                        key_id,
                        code: None,
                        timestamp,
                        repeat,
                        active_app,
                    };

                    let res = app_handle.emit("klick-keyboard", payload);
                    if let Err(e) = res {
                        println!("Failed to emit keydown: {:?}", e);
                    }
                }
                EventType::KeyRelease(key) => {
                    let key_id = map_key(key);
                    if key_id == "Unknown" {
                        return;
                    }
                    println!("Rust captured KeyRelease: {}", key_id);

                    {
                        let mut keys = held_keys.lock().unwrap();
                        keys.remove(&key_id);
                    }

                    let active_app = get_active_app_name();

                    let payload = KeyboardEventPayload {
                        event: "keyup".to_string(),
                        key_id,
                        code: None,
                        timestamp,
                        repeat: false,
                        active_app,
                    };

                    let _ = app_handle.emit("klick-keyboard", payload);
                }
                _ => {}
            }
        };

        if let Err(error) = listen(callback) {
            eprintln!("Global keyboard listener failed: {:?}", error);
        }
    });
}
