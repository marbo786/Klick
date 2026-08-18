/**
 * Klick — Main Entry Point
 * 
 * Wires together the audio engine, UI components, persistence,
 * and handles the application lifecycle.
 */

import './style.css';
import { AudioEngine } from './synth/AudioEngine.ts';
import { AppController } from './ui/AppController.ts';

// ─── Application State ──────────────────────────────────────────────────────

const engine = new AudioEngine();
(window as any).engine = engine; // Expose for testing

const app = new AppController(engine);
app.initialize();

// ─── Cleanup (for HMR in dev) ───────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    app.dispose();
    engine.dispose();
  });
}
