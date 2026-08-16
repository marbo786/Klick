use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyboardEventPayload {
    pub event: String,       // "keydown" or "keyup"
    #[serde(rename = "keyId")]
    pub key_id: String,      // Normalized physical key (e.g., 'KeyA')
    pub code: Option<String>,// Optional raw code
    pub timestamp: f64,      // Capture time (for internal delta scheduling)
    pub repeat: bool,
    #[serde(rename = "activeApp")]
    pub active_app: Option<String>,
}
