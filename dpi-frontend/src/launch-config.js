export const dataApps = ['analyze_paths.py', 'extract_azix.py', 'generate_all_ips.py', 'netmon_analyzer.py'];
const connectionFields = [
  { key: 'src_ip', label: 'Source IPv4 address', kind: 'ipv4', required: true },
  { key: 'src_port', label: 'Source port', kind: 'port', required: true },
  { key: 'dst_ip', label: 'Destination IPv4 address', kind: 'ipv4', required: true },
  { key: 'dst_port', label: 'Destination port', kind: 'port', required: true },
  { key: 'seq', label: 'TCP sequence number', kind: 'sequence', required: true },
];
const profiles = {
  'dropshape.py': [
    { key: 'host', label: 'TLS hostname', required: true },
    { key: 'ip', label: 'Destination IPv4 address', kind: 'ipv4', required: true },
  ],
  'make_xray.py': [
    { key: 'host', label: 'Server hostname', flag: '--host', required: true },
    { key: 'uuid', label: 'Connection UUID', kind: 'uuid', flag: '--uuid', required: true },
    { key: 'ws-path', label: 'WebSocket path (optional)', flag: '--ws-path' },
    { key: 'port', label: 'Server port (optional; default 443)', kind: 'port', flag: '--port' },
    { key: 'socks-port', label: 'SOCKS port (optional; default 1081)', kind: 'port', flag: '--socks-port' },
    { key: 'output', label: 'New output file path (optional)', flag: '--output' },
  ],
  'spoof_rst.py': connectionFields,
  'fake_rst.py': connectionFields,
};

export function launchFields(file) {
  if (dataApps.includes(file)) return [
    { key: 'data-dir', label: 'Saved traceroute directory (optional; blank uses configured data)', flag: '--data-dir' },
    ...(['extract_azix.py', 'generate_all_ips.py'].includes(file) ? [{ key: 'output', label: 'Output file path (optional)', flag: '--output' }] : []),
  ];
  return profiles[file] || null;
}

export function launchArguments(file, values) {
  const fields = launchFields(file);
  if (!fields) return undefined;
  const result = [];
  for (const field of fields) {
    const value = String(values[field.key] ?? '').trim();
    if (!value) {
      if (field.required) throw new Error(`${field.label} is required`);
      continue;
    }
    if (/[\0\r\n]/.test(value) || value.length > 1024) throw new Error(`${field.label} is invalid`);
    if (field.kind === 'ipv4' && !(value.split('.').length === 4 && value.split('.').every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255))) throw new Error(`${field.label} must be a valid IPv4 address`);
    if (['port', 'sequence'].includes(field.kind)) {
      const maximum = field.kind === 'port' ? 65535 : 4294967295;
      const minimum = field.kind === 'port' ? 1 : 0;
      if (!/^\d+$/.test(value) || Number(value) < minimum || Number(value) > maximum) throw new Error(`${field.label} is out of range`);
    }
    if (field.kind === 'uuid' && !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) throw new Error('Enter a valid connection UUID');
    if (field.key === 'ws-path' && !value.startsWith('/')) throw new Error('WebSocket path must begin with /');
    if (field.flag) result.push(field.flag);
    result.push(value);
  }
  return result.length ? result : undefined;
}
