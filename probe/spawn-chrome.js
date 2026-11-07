const { spawn } = require('child_process');
const path = require('path');

const chrome = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const profile = path.resolve('probe/chrome-profile');

const args = [
  '--remote-debugging-port=9333',
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--proxy-server=http://127.0.0.1:10808',
  '--ignore-certificate-errors',
  '--window-size=1600,950',
  '--lang=zh-CN',
  'https://athena-test.digiwincloud.com.cn/',
];

const child = spawn(chrome, args, { detached: true, stdio: 'ignore' });
child.unref();
console.log('spawned pid', child.pid);
