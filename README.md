# KLICK — High Fidelity Mechanical Engine 🎛️

Klick is a premium, opinionated desktop audio utility built for mechanical keyboard enthusiasts and audiophiles. It captures global keystrokes and runs them through a zero-latency WebAudio synthesizer engine, delivering highly realistic, deeply customizable switch acoustics right to your headphones.

Inspired by vintage analog audio receivers and turntable pitch faders, Klick isn't just a software tool—it feels like a native hardware instrument on your desktop.

## Features

- **Global Key Capture**: Uses native OS hooks (via Rust) to perfectly detect every keystroke anywhere in your operating system with zero latency.
- **Parametric DSP Engine**: Synthesizes mechanical switch audio using custom white noise bursts, bandpass filters, envelope generators, and sine wave resonators.
- **Custom Tone Arm Designer**: Fully customize the click (transient) and bottom-out (thock) acoustics with sliders for frequency, resonance, decay time, low-pass filters, and noise mix.
- **Hardware Aesthetic**: A dense, minimalist user interface inspired by vintage stereos, featuring brushed metallic faders, glowing amber accents, and a live audio waveform visualizer.
- **Application Muting**: Specify applications (like `Code.exe` or `Spotify.exe`) where Klick will automatically mute itself when that application is in focus.
- **Preset Management**: Comes with beautifully tuned built-in presets (Cherry MX Blue, Red, Topre, Buckling Spring) and allows saving, importing, and exporting your own custom tuning profiles as JSON.
- **Background Autostart**: Seamlessly launches silently in your system tray on boot.

## Technology Stack

Klick is architected for maximum performance and a tiny memory footprint:
- **Tauri**: The core desktop application framework, providing native system tray integration and drastically lower resource usage than Electron.
- **Rust**: Handles the low-level Windows API keyboard hooking (`SetWindowsHookExW`), foreground application tracking, and secure inter-process communication (IPC) with the webview.
- **Vite & TypeScript**: Powers the frontend logic and zero-dependency DOM manipulation. 
- **WebAudio API**: Drives the high-performance synthesis engine natively in the browser view.
- **Vanilla CSS**: A custom, token-based design system built from scratch with zero bloated CSS frameworks (no Tailwind).

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://www.rust-lang.org/tools/install)
- Windows OS (Currently optimized for Windows global hooks)

### Installation & Development

1. Clone the repository:
   ```bash
   git clone https://github.com/marbo786/Klick.git
   cd Klick
   ```

2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Start the development server (this will compile the Rust backend and launch the app):
   ```bash
   npx tauri dev
   ```

### Building for Production

To create a standalone `.msi` Windows installer and executable:

```bash
npx tauri build
```
The compiled installer will be located in `src-tauri/target/release/bundle/msi/`.

## Architecture Overview

- **`src-tauri/src/keyboard/`**: Contains the Rust modules for the global keyboard hook, key mapping, and active window detection.
- **`src/synth/`**: Contains the TypeScript DSP engine (`AudioEngine.ts`, `Voice.ts`, `Envelope.ts`) responsible for generating the procedural sound.
- **`src/ui/`**: Contains the object-oriented UI components that bind to the DOM (`Designer.ts`, `VolumeControl.ts`, `PresetSelector.ts`).

## License
MIT License