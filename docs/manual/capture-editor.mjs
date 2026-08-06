/**
 * The signed-in editor screens, captured by driving Chrome rather than asking
 * it for a screenshot and hoping.
 *
 *     node docs/manual/capture-editor.mjs
 *
 * WHY THIS EXISTS. `chrome --screenshot` fires as soon as the page load event
 * settles, and Sveltia is a single-page app that then goes and fetches the
 * whole site from GitHub. Every capture came out as its "Loading Site Data…"
 * splash. Neither `--virtual-time-budget` (which advances VIRTUAL time, and
 * the fetch is real network) nor `--timeout` waits for it. There is no flag
 * for "wait until the application has drawn"; there is only the DevTools
 * protocol.
 *
 * So: launch Chrome with a debugging port, connect, navigate, POLL THE PAGE
 * until the thing we want is actually on screen, then capture. No puppeteer
 * and no playwright — Node has a WebSocket client built in, and this is about
 * sixty lines of it. A browser-automation dependency in a counsellor's website
 * repository, for four pictures in a manual, is not a trade worth making.
 *
 * The session comes from a Chrome profile signed in once by hand; see
 * capture.sh. This works on a COPY of it, so the window you signed in with can
 * stay open — Chrome refuses to share a profile between instances.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, cpSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'images');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = process.env.PROFILE || join(process.env.HOME, '.cache/gosscounselling-manual-chrome');
const BASE = process.env.BASE || 'https://gosscounselling-co-uk.stage.denfrievilje.dk';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const PORT = 9333;

/**
 * What to capture. `ready` is evaluated in the page until it returns true —
 * it is the difference between a screenshot of the editor and a screenshot of
 * the editor's loading splash.
 */
const SHOTS = [
  {
    file: '02-collections.png',
    path: '/admin/#/collections/home',
    height: 820,
    ready: `!!document.querySelector('.sui.app-shell') &&
            [...document.querySelectorAll('*')].some(e => e.textContent.trim() === 'Qualifications and membership')`
  },
  {
    file: '03-entry.png',
    path: '/admin/#/collections/home/entries/services',
    height: 820,
    ready: `[...document.querySelectorAll('*')].some(e => e.textContent.trim() === 'Menu wording')`
  },
  {
    // An edit in progress, with the way out of it open. `act` runs in the page
    // after `ready` and before the shutter — it types into a field and opens
    // that field's own menu, so the picture shows the undo where John will
    // meet it rather than described from memory.
    //
    // It NEVER SAVES. Nothing here clicks Save, and the browser is a throwaway
    // copy of the profile, so the entry is untouched either way.
    file: '07-undo.png',
    path: '/admin/#/collections/home/entries/services',
    height: 700,
    ready: `[...document.querySelectorAll('*')].some(e => e.textContent.trim() === 'Menu wording')`,
    // Find the field by its VALUE, then walk up to the smallest ancestor that
    // holds both it and its own ⋮ button. Going up a fixed number of levels
    // from the label was the first attempt and it landed one row early, so the
    // picture showed "How I can help you" typed into "Small label above the
    // heading" — a coherent-looking screenshot of nonsense, which is the worst
    // kind to put in a manual.
    act: `(() => {
      const input = [...document.querySelectorAll('input')].find(
        (i) => i.value === 'How I can help'
      );
      if (!input) return false;
      let row = input.parentElement;
      while (row && !row.querySelector('button[aria-label="Show Field Options"]')) {
        row = row.parentElement;
      }
      if (!row) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'How I can help you');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      row.querySelector('button[aria-label="Show Field Options"]').click();
      return true;
    })()`
  },
  {
    // The saved history of one entry: who changed it and when.
    file: '08-history.png',
    path: '/admin/#/collections/home/entries/services',
    height: 700,
    ready: `[...document.querySelectorAll('*')].some(e => e.textContent.trim() === 'Menu wording')`,
    act: `(() => {
      const b = document.querySelector('button[aria-label="History"]');
      if (!b) return false;
      b.click();
      return true;
    })()`
  },
  {
    // The account menu, which carries both "Sign In with Mobile" and
    // "Sign Out".
    //
    // THE QR CODE ITSELF IS DELIBERATELY NOT CAPTURED. It encodes a live
    // session for whoever scans it; a screenshot of one committed to a public
    // repository is a published credential. The manual describes that step in
    // words instead, which costs a picture and no security.
    file: '09-account-menu.png',
    path: '/admin/#/collections/home',
    height: 700,
    ready: `!!document.querySelector('button[aria-label="Show Account Menu"]')`,
    act: `(() => {
      document.querySelector('button[aria-label="Show Account Menu"]').click();
      return true;
    })()`
  },
  {
    file: '06-all-assets.png',
    path: '/admin/#/assets/-/all',
    height: 820,
    ready: `[...document.querySelectorAll('*')].some(e => e.textContent.trim() === 'All Assets')`
  },
  {
    file: '05-picture-field.png',
    path: '/admin/#/collections/home/entries/hero',
    height: 1000,
    ready: `[...document.querySelectorAll('*')].some(e => e.textContent.trim() === 'Your photograph')`
  }
];

if (!existsSync(PROFILE)) {
  console.error(`No capture profile at ${PROFILE}. Run:  docs/manual/capture.sh login`);
  process.exit(1);
}

// A copy, so the window used to sign in can stay open — but only the parts
// that carry the session. The whole profile is ~150 MB of caches and Chrome
// takes long enough to open it that the debugging port looks like it never
// bound at all; that is what "Chrome never opened its debugging port" was.
const userDir = mkdtempSync(join(tmpdir(), 'goss-capture-'));
mkdirSync(join(userDir, 'Default'), { recursive: true });
for (const part of [
  'Local State',
  'Default/Preferences',
  'Default/Cookies',
  'Default/Local Storage',
  'Default/Session Storage',
  'Default/IndexedDB'
]) {
  const from = join(PROFILE, part);
  if (existsSync(from)) cpSync(from, join(userDir, part), { recursive: true });
}

const chrome = spawn(CHROME, [
  // `=new` explicitly: bare --headless did not open the debugging port on
  // Chrome 151, though it still served --screenshot.
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',
  `--user-agent=${UA}`,
  `--user-data-dir=${userDir}`,
  `--remote-debugging-port=${PORT}`,
  '--window-size=1100,820',
  'about:blank'
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The debugging endpoint takes a moment to bind. */
async function debuggerUrl() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(500);
    }
  }
  throw new Error('Chrome never opened its debugging port');
}

let nextId = 1;
function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', (e) => reject(new Error('devtools socket failed: ' + e.message)));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return { ws, ready, send };
}

try {
  const { ready, send, ws } = connect(await debuggerUrl());
  await ready;

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  const call = (m, p) => send(m, p, sessionId);

  await call('Page.enable');
  await call('Runtime.enable');

  for (const shot of SHOTS) {
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1100,
      height: shot.height,
      deviceScaleFactor: 2,
      mobile: false
    });

    // A hash change alone does not reload the app, so go via about:blank.
    await call('Page.navigate', { url: 'about:blank' });
    await sleep(200);
    await call('Page.navigate', { url: BASE + shot.path });

    // Poll the page itself. This is the whole point of the file.
    let drawn = false;
    for (let i = 0; i < 80; i++) {
      await sleep(500);
      const { result } = await call('Runtime.evaluate', {
        expression: `(() => { try { return ${shot.ready} } catch (e) { return false } })()`,
        returnByValue: true
      });
      if (result?.value === true) {
        drawn = true;
        break;
      }
    }
    if (!drawn) {
      throw new Error(
        `${shot.file}: the page never drew what was asked for. Either the editor is signed out ` +
          `(run: docs/manual/capture.sh login) or the \`ready\` test in this file is stale.`
      );
    }

    // Anything the shot needs done to it — typing, opening a menu — happens
    // here, once the page has drawn and before the shutter.
    if (shot.act) {
      const { result } = await call('Runtime.evaluate', {
        expression: shot.act,
        returnByValue: true
      });
      if (result?.value !== true) {
        throw new Error(`${shot.file}: its \`act\` did not report success — the markup it reaches for has probably moved.`);
      }
      await sleep(500);
    }

    // Let the last of the type settle before the shutter.
    await sleep(600);
    const { data } = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(OUT, shot.file), Buffer.from(data, 'base64'));
    console.log(`  ${shot.file}`);
  }

  ws.close();
} finally {
  chrome.kill('SIGKILL');
  rmSync(userDir, { recursive: true, force: true });
}
