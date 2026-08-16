import { AudioEngine } from '../synth/AudioEngine.ts';
import { isTauri } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface GlobalKeyboardEvent {
  event: 'keydown' | 'keyup';
  keyId: string;
  code?: string;
  timestamp: number;
  repeat: boolean;
  activeApp?: string;
}

export interface InputEventSource {
  start(): Promise<void>;
  stop(): Promise<void>;
}

const MODIFIER_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight']);
const NAV_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape']);
const FN_KEYS = new Set(Array.from({length: 12}, (_, i) => `F${i + 1}`));

function isRepeatIgnored(code: string): boolean {
  return MODIFIER_KEYS.has(code) || NAV_KEYS.has(code) || FN_KEYS.has(code);
}

class BrowserInputSource implements InputEventSource {
  private heldKeys = new Set<string>();
  private lastSpaceTime = 0;
  private engine: AudioEngine;

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  public async start(): Promise<void> {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  public async stop(): Promise<void> {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.handleBlur(); // Clear held keys
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    const code = event.code;
    
    if (event.repeat) {
      if (isRepeatIgnored(code)) return;
      
      let volumeScale = 0.707; // -3dB
      
      if (code === 'Space') {
        const now = performance.now();
        if (now - this.lastSpaceTime < 66) return;
        this.lastSpaceTime = now;
      }
      
      this.engine.keyDown(code, undefined, volumeScale);
    } else {
      if (!this.heldKeys.has(code)) {
        this.heldKeys.add(code);
        this.engine.keyDown(code);
      }
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    const code = event.code;
    this.heldKeys.delete(code);
    this.engine.keyUp(code);
  };

  private handleBlur = () => {
    for (const code of this.heldKeys) {
      this.engine.keyUp(code);
    }
    this.heldKeys.clear();
  };
}

class DesktopInputSource implements InputEventSource {
  private heldKeys = new Set<string>();
  private lastSpaceTime = 0;
  private unlistenFn: UnlistenFn | null = null;
  private engine: AudioEngine;
  private mutedApps: string[] = [];

  constructor(engine: AudioEngine) {
    this.engine = engine;
  }

  public setMutedApps(apps: string[]) {
    this.mutedApps = apps;
  }

  public async start(): Promise<void> {
    this.unlistenFn = await listen<GlobalKeyboardEvent>('klick-keyboard', (event) => {
      // If the app has focus, rdev might drop events, but BrowserInputSource handles them perfectly.
      // To avoid duplicate sounds when rdev *does* capture them in focus, we abort here.
      if (document.hasFocus()) return;

      const payload = event.payload;
      if (payload.activeApp && this.mutedApps.includes(payload.activeApp)) return;

      const code = payload.keyId; // Use the normalized physical key identity

      if (payload.event === 'keydown') {
        if (payload.repeat) {
          if (isRepeatIgnored(code)) return;
          
          let volumeScale = 0.707; // -3dB
          
          if (code === 'Space') {
            const now = performance.now();
            if (now - this.lastSpaceTime < 66) return;
            this.lastSpaceTime = now;
          }
          
          this.engine.keyDown(code, undefined, volumeScale);
        } else {
          if (!this.heldKeys.has(code)) {
            this.heldKeys.add(code);
            this.engine.keyDown(code);
          }
        }
      } else if (payload.event === 'keyup') {
        this.heldKeys.delete(code);
        this.engine.keyUp(code);
      }
    });
  }

  public async stop(): Promise<void> {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    for (const code of this.heldKeys) {
      this.engine.keyUp(code);
    }
    this.heldKeys.clear();
  }
}

export class InputHandler {
  private browserSource: BrowserInputSource;
  private desktopSource: DesktopInputSource;

  constructor(_textarea: HTMLTextAreaElement, engine: AudioEngine) {
    this.browserSource = new BrowserInputSource(engine);
    this.desktopSource = new DesktopInputSource(engine);
    
    // Auto-detect and start the appropriate source
    this.initialize();
  }

  public setMutedApps(apps: string[]) {
    this.desktopSource.setMutedApps(apps);
  }

  private async initialize() {
    // ALWAYS start BrowserInputSource to handle focused keystrokes
    await this.browserSource.start();

    if (isTauri()) {
      console.log('[Klick] Tauri detected. Starting DesktopInputSource for background keys.');
      await this.desktopSource.start();
    }
  }

  public dispose() {
    this.browserSource.stop();
    this.desktopSource.stop();
  }
}
