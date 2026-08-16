import puppeteer from 'puppeteer';
import { assert } from 'console';

async function runTests() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Capture page console
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.toString()));

  console.log('Navigating to app...');
  await page.goto('http://localhost:5173/');
  
  // 1. Audio Initialization
  console.log('Testing Audio Initialization...');
  await page.click('body');
  await page.waitForTimeout(500); // Give AudioContext time to resume
  
  let state = await page.evaluate(() => window.engine.getState());
  if (state !== 'running') {
    throw new Error(`AudioContext failed to start. State: ${state}`);
  }
  
  // 2. Typing Tests
  console.log('Testing Single Key...');
  await page.type('#typing-area', 'a');
  await page.waitForTimeout(100);
  let voices = await page.evaluate(() => window.engine.getDiagnostics().activeVoiceCount);
  console.log(`Active voices after single key: ${voices}`);
  
  console.log('Testing Rapid Typing...');
  await page.type('#typing-area', 'asdfghjkl;', { delay: 20 });
  await page.waitForTimeout(100);
  voices = await page.evaluate(() => window.engine.getDiagnostics().activeVoiceCount);
  console.log(`Active voices after rapid typing: ${voices}`);

  console.log('Testing Burst Typing...');
  await page.evaluate(() => {
    const ta = document.querySelector('#typing-area');
    for(let i=0; i<30; i++) {
      ta.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', repeat: false }));
      ta.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
    }
  });
  await page.waitForTimeout(100);
  voices = await page.evaluate(() => window.engine.getDiagnostics().activeVoiceCount);
  console.log(`Active voices after burst: ${voices}`);

  // 3. Modifier & Navigation Keys
  console.log('Testing Modifiers & Navigation...');
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(100);
  
  // 4. Voice Cleanup (Wait for envelope decay)
  console.log('Waiting for voice cleanup (1000ms)...');
  await page.waitForTimeout(1000);
  voices = await page.evaluate(() => window.engine.getDiagnostics().activeVoiceCount);
  console.log(`Active voices after cleanup: ${voices}`);
  if (voices > 0) {
     console.warn(`WARNING: Voices did not clean up properly! Active: ${voices}`);
  } else {
     console.log('Voice cleanup successful.');
  }

  // 5. Preset Switching
  console.log('Testing Preset Switching...');
  const presets = ['cherry-mx-brown', 'buckling-spring', 'topre', 'silent-red'];
  for (const preset of presets) {
     await page.evaluate((id) => {
       const btn = document.querySelector(`.preset-card[data-id="${id}"]`);
       if(btn) btn.click();
     }, preset);
     await page.waitForTimeout(100);
     const currentPreset = await page.evaluate(() => window.engine.getDiagnostics().currentPresetId);
     console.log(`Switched to preset: ${currentPreset}`);
  }

  console.log('Tests completed.');
  await browser.close();
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
