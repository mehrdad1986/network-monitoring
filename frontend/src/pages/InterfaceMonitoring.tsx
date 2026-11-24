import { UIIcon } from '../components/UIIcon';
import { useState } from 'react';
import './InterfaceMonitoring.css';

export const InterfaceMonitoring = () => {
  const [interfaces] = useState([
    { id: 1, name: 'eth0', status: 'up', speed: '1000 Mbps', mtu: 1500, packets: 1024532, errors: 0 },
    { id: 2, name: 'eth1', status: 'up', speed: '1000 Mbps', mtu: 1500, packets: 512894, errors: 2 },
    { id: 3, name: 'eth2', status: 'down', speed: '0 Mbps', mtu: 1500, packets: 0, errors: 0 },
    { id: 4, name: 'lo', status: 'up', speed: 'loopback', mtu: 65536, packets: 8493012, errors: 0 },
  ]);

  return (
    <div className="interface-monitoring">
      <h1>Interface Monitoring</h1>
      <p>Network interface status and statistics</p>
      <div className="interfaces-table">
        <div className="header">
          <div>Interface</div>
          <div>Status</div>
          <div>Speed</div>
          <div>Packets</div>
          <div>Errors</div>
        </div>
        {interfaces.map(i => (
          <div key={i.id} className={`row ${i.status}`}>
            <div>{i.name}</div>
            <div>{i.status === 'up' ? <><UIIcon symbol="🟢" /> up</> : <><UIIcon symbol="🔴" /> down</>}</div>
            <div>{i.speed}</div>
            <div>{i.packets.toLocaleString()}</div>
            <div>{i.errors}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
