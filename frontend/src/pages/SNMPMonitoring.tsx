import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './SNMPMonitoring.css';

export const SNMPMonitoring = () => {
  const [devices] = useState([
    { id: 1, name: 'Router-1', ip: '192.168.1.1', status: 'online', uptime: '45d 12h', sysDescr: 'Cisco Router' },
    { id: 2, name: 'Switch-1', ip: '192.168.1.2', status: 'online', uptime: '32d 05h', sysDescr: 'Juniper Switch' },
    { id: 3, name: 'Firewall-1', ip: '192.168.1.3', status: 'online', uptime: '128d 18h', sysDescr: 'Palo Alto FW' },
    { id: 4, name: 'UPS-1', ip: '192.168.1.4', status: 'online', uptime: '200d 02h', sysDescr: 'APC UPS' },
    { id: 5, name: 'Printer-1', ip: '192.168.1.5', status: 'offline', uptime: '0h', sysDescr: 'HP LaserJet' },
  ]);

  return (
    <div className="snmp-monitoring">
      <h1>SNMP Monitoring</h1>
      <p>Network device status via SNMP</p>
      <div className="devices-list">
        {devices.map(d => (
          <div key={d.id} className={`device-card ${d.status}`}>
            <div className="device-header">
              <h3>{d.name}</h3>
              <span className={`status ${d.status}`}>{d.status === 'online' ? <><UIIcon symbol="🟢" /></> : <><UIIcon symbol="🔴" /></>} {d.status}</span>
            </div>
            <div className="device-info">
              <p>IP: <code>{d.ip}</code></p>
              <p>Uptime: {d.uptime}</p>
              <p>Type: {d.sysDescr}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
