<div align="center">

# 🎛️ Klick

### High-Fidelity Mechanical Keyboard Engine

[![Tauri](https://img.shields.io/badge/Tauri-2.11-FFC131?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-rdev-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![WebAudio](https://img.shields.io/badge/WebAudio_API-DSP_Engine-FF4088?style=for-the-badge&logo=webaudio&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Release](https://img.shields.io/badge/Release-v0.1.0-blue?style=for-the-badge)](https://github.com/marbo786/Klick/releases/tag/v0.1.0)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)](LICENSE)

*Every keystroke, synthesized. Real switch acoustics, zero hardware required.*

[Overview](#-overview) · [Architecture](#️-architecture) · [Tech Stack](#️-tech-stack) · [Project Structure](#-project-structure) · [Getting Started](#-getting-started) · [Usage](#-usage) · [Download](#-download)

</div>

---

## 📌 Overview

**Klick** is a premium, opinionated desktop audio utility for mechanical keyboard enthusiasts and audiophiles. It listens for global keystrokes and runs them through a zero-latency WebAudio synthesizer, producing highly realistic, deeply customizable switch acoustics through your headphones — no physical switches required.

Inspired by vintage analog audio receivers and turntable pitch faders, Klick doesn't feel like a settings panel — it feels like a native hardware instrument sitting on your desktop.

**Highlights:**

- 🎹 **Global Key Capture** — Listens for every keystroke system-wide with virtually zero latency
- 🎚️ **Parametric DSP Engine** — Procedural switch audio from white noise bursts, bandpass filters, envelope generators, and sine resonators — no sample libraries
- 🛠️ **Tone Arm Designer** — Live sliders for click (transient) and bottom-out (thock) frequency, resonance, decay, low-pass, and noise mix
- 🔇 **Application Muting** — Auto-mutes when a chosen app (e.g. `Spotify.exe`) is in focus
- 💾 **Preset Management** — 6 tuned built-in profiles, plus save/import/export of custom JSON tuning profiles
- 🚀 **Background Autostart** — Launches silently into the system tray on boot

---

## 🏗️ Architecture

Klick splits responsibility across a Rust-native backend (system-level key listening) and a TypeScript/WebAudio frontend (sound synthesis):

```
╔══════════════════════════════════════════════════════════════════════╗
║                          KLICK SIGNAL PATH                           ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║   [ OS Keystroke ]                                                    ║
║          │                                                           ║
║          ▼                                                           ║
║  ┌─────────────────────┐                                             ║
║  │  Rust Key Listener  │  ← listener.rs (rdev) captures raw events,  ║
║  │  (src-tauri)        │    mapper.rs resolves them to key IDs       ║
║  └──────────┬──────────┘                                             ║
║             │  Tauri IPC event                                       ║
║             ▼                                                        ║
║  ┌─────────────────────┐                                             ║
║  │  Active App Filter  │  ← active_app.rs checks foreground process  ║
║  │                     │    against the user's mute list             ║
║  └──────────┬──────────┘                                             ║
║             │  key-down / key-up                                     ║
║             ▼                                                        ║
║  ┌─────────────────────┐                                             ║
║  │  Voice Manager      │  ← VoiceManager.ts allocates a Voice per    ║
║  │  (src/synth)        │    keypress from the active preset          ║
║  └──────────┬──────────┘                                             ║
║             │                                                        ║
║             ▼                                                        ║
║  ┌─────────────────────┐                                             ║
║  │  Voice DSP Chain    │  ← NoiseBuffer → bandpass filters →         ║
║  │                     │    Envelope → sine resonators                ║
║  └──────────┬──────────┘                                             ║
║             │                                                        ║
║             ▼                                                        ║
║  ┌─────────────────────┐                                             ║
║  │  Master Bus         │  ← MasterBus.ts mixes voices, drives the    ║
║  │                     │    live waveform visualizer                  ║
║  └──────────┬──────────┘                                             ║
║             │                                                        ║
║             ▼                                                        ║
║   [ Headphone Output ]                                                ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

### Module Responsibilities

| # | Module | Role |
|---|--------|------|
| 1 | **Key Listener** (`src-tauri/src/keyboard/listener.rs`) | Uses the `rdev` crate to listen for global keyboard events and forwards them over Tauri IPC |
| 2 | **Key Mapper** (`mapper.rs`) | Translates `rdev` key events into normalized key identifiers |
| 3 | **Active App Tracker** (`active_app.rs`) | Polls the foreground window to enforce per-application muting |
| 4 | **App Controller** (`src/ui/AppController.ts`) | Wires incoming keyboard IPC events to the audio engine and UI |
| 5 | **Voice Manager** (`src/synth/VoiceManager.ts`) | Allocates and releases synth voices per keystroke, pulling parameters from the active preset |
| 6 | **Audio Engine** (`AudioEngine.ts`, `Voice.ts`, `Envelope.ts`, `NoiseBuffer.ts`) | Procedurally synthesizes each click/thock from noise + filters + envelopes |
| 7 | **Master Bus** (`MasterBus.ts`) | Sums all active voices and feeds the waveform visualizer |
| 8 | **Persistence** (`src/storage/persistence.ts`) | Saves, imports, and exports custom tuning profiles as JSON |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Shell** | Tauri 2 · native system tray · autostart plugin |
| **Global Input** | Rust · `rdev` · `windows-sys` (foreground app detection) |
| **Audio Synthesis** | WebAudio API · custom parametric DSP (noise, bandpass, envelope, resonance) |
| **Frontend Logic** | TypeScript · Vite 8 |
| **Styling** | Vanilla CSS (token-based design system, no frameworks) |
| **Persistence** | JSON-based preset import/export |

---

## 📂 Project Structure

```
Klick/
├── src-tauri/
│   ├── src/
│   │   ├── keyboard/
│   │   │   ├── listener.rs     # rdev-based global key listener
│   │   │   ├── mapper.rs       # Key event → key identifier mapping
│   │   │   ├── events.rs       # Event payload definitions
│   │   │   ├── active_app.rs   # Foreground app detection for muting
│   │   │   └── mod.rs          # Module wiring + init hook
│   │   ├── lib.rs              # Tauri app setup, command registration
│   │   └── main.rs             # Entry point
│   ├── capabilities/
│   │   └── default.json        # Tauri permission capabilities
│   ├── icons/                  # Cross-platform app icons
│   └── tauri.conf.json         # Window, bundle, and permission config
├── src/
│   ├── synth/
│   │   ├── AudioEngine.ts      # Top-level synthesis orchestrator
│   │   ├── Voice.ts            # Single-keystroke voice (click + thock)
│   │   ├── VoiceManager.ts     # Voice allocation/lifecycle
│   │   ├── Envelope.ts         # ADSR-style envelope generation
│   │   ├── NoiseBuffer.ts      # Procedural white noise source
│   │   ├── MasterBus.ts        # Mix bus + visualizer tap
│   │   ├── KeyProfiles.ts      # Per-key acoustic variation
│   │   └── types.ts            # Shared synth type definitions
│   ├── presets/                # blue · brown · red · silent-red · topre · buckling-spring
│   ├── storage/
│   │   └── persistence.ts      # Preset save/import/export
│   ├── ui/
│   │   ├── AppController.ts    # Binds keyboard IPC events to app state
│   │   ├── Designer.ts         # Tone Arm Designer controls
│   │   ├── InputHandler.ts     # UI input/event wiring
│   │   ├── PresetSelector.ts   # Preset picker
│   │   ├── VolumeControl.ts    # Master volume fader
│   │   └── WaveformVisualizer.ts  # Live waveform rendering
│   ├── main.ts                 # Frontend entry point
│   └── style.css               # Token-based design system
├── public/                     # Static assets
└── index.html
```

---

## 🚀 Getting Started

### Prerequisites

- **[Node.js](https://nodejs.org/)** v18+
- **[Rust](https://www.rust-lang.org/tools/install)** — required to compile the backend
- **Windows OS** — currently optimized for Windows (foreground-app muting relies on `windows-sys`)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/marbo786/Klick.git
cd Klick

# 2. Install frontend dependencies
npm install

# 3. Launch the dev build (compiles the Rust backend + starts the app)
npx tauri dev
```

### Building for Production

```bash
npx tauri build
```

The standalone `.msi`/`setup.exe` installer will be generated at:

```
src-tauri/target/release/bundle/
```

---

## 📥 Download

The first public build is available on the [Releases page](https://github.com/marbo786/Klick/releases/tag/v0.1.0):

- **[Klick_0.1.0_x64-setup.exe](https://github.com/marbo786/Klick/releases/download/v0.1.0/Klick_0.1.0_x64-setup.exe)** — Windows installer

> Windows SmartScreen may flag the installer as unrecognized since the app is newly published and unsigned — choose **More Info → Run anyway**.

---

## 🧑‍💻 Usage

1. Launch Klick — it opens as a compact desktop panel and minimizes to the system tray
2. Pick a built-in preset (Cherry MX Blue, Brown, Red, Silent Red, Topre, or Buckling Spring) from the **Preset Selector**
3. Open the **Tone Arm Designer** to fine-tune click/thock frequency, resonance, decay, low-pass, and noise mix live as you type
4. Add applications to the mute list so Klick goes silent while you're in a call or watching a video
5. Save your tuning as a custom preset, or export it as JSON to share

---

## 🎨 Customization

Every preset is a plain TypeScript object describing the click and thock acoustics (`src/presets/`). Duplicate an existing preset, tweak the frequency/resonance/decay/noise-mix parameters, and register it in `src/presets/index.ts` to add your own switch profile.

---

## 🤝 Contributing

Pull requests are welcome. For larger changes, please open an issue first to discuss what you'd like to change.

---

## 👤 Author

**Mohsin** — [@marbo786](https://github.com/marbo786) · [LinkedIn](https://linkedin.com/in/marbo123)

---

<div align="center">

*Built with Tauri · Rust · WebAudio API*

</div>
