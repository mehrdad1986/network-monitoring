// Optional, administrator-approved launcher. Capabilities apply to this service only.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const backend = resolve(process.env.DPI_BACKEND_DIR || resolve(fileURLToPath(new URL('../../integrations/dpi-apps', import.meta.url))));
const uid = process.getuid();
const gid = process.getgid();
if (uid === 0) throw new Error('Run this launcher as your normal desktop user after sudo -v; the service must not run as root.');
mkdirSync(resolve(root, '.runs'), { recursive: true, mode: 0o700 });
const quote = value => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const args = ['-n', 'systemd-run', '--unit=dpi-apps-packets', '--collect',
  `--property=User=${uid}`, `--property=Group=${gid}`,
  `--property=WorkingDirectory=${root}`,
  '--property=AmbientCapabilities=CAP_NET_RAW', '--property=CapabilityBoundingSet=CAP_NET_RAW',
  '--property=NoNewPrivileges=yes', '--property=ProtectSystem=strict', '--property=ProtectHome=read-only',
  `--property=ReadWritePaths=${quote(resolve(root, '.runs'))} ${quote(backend)}`,
  '--property=PrivateTmp=yes', '--property=UMask=0077', '--property=KillMode=control-group', '--property=TimeoutStopSec=8',
  '--setenv=PORT=3100', `--setenv=DPI_BACKEND_DIR=${backend}`,
  ...(process.env.DPI_PYTHON ? [`--setenv=DPI_PYTHON=${process.env.DPI_PYTHON}`] : []),
  ...(process.env.NETMON_DATA_DIR ? [`--setenv=NETMON_DATA_DIR=${process.env.NETMON_DATA_DIR}`] : []),
  process.execPath, resolve(root, 'scripts/serve.mjs')];
const result = spawnSync('sudo', args, { stdio: 'inherit', shell: false });
if (result.error || result.status !== 0) {
  console.error('Packet service was not started. Authenticate with sudo -v in your terminal, stop the existing port-3100 server, and retry.');
  process.exitCode = 1;
} else {
  console.log('Packet service started as your normal user with CAP_NET_RAW only.');
  console.log('Status: systemctl status dpi-apps-packets');
  console.log('Stop: sudo systemctl stop dpi-apps-packets');
}
