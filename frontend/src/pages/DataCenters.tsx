import { UIIcon } from '../components/UIIcon';
import { useState } from 'react'; import './DataCenters.css';
export const DataCenters = () => {
  const [dcs] = useState([
    { id: 1, name: 'US-East', region: 'Virginia', servers: 256, capacity: 92.5, status: 'operational' },
    { id: 2, name: 'US-West', region: 'California', servers: 384, capacity: 78.3, status: 'operational' },
    { id: 3, name: 'EU-Central', region: 'Frankfurt', servers: 192, capacity: 65.1, status: 'operational' },
    { id: 4, name: 'APAC-SG', region: 'Singapore', servers: 128, capacity: 45.2, status: 'operational' },
    { id: 5, name: 'BR-South', region: 'São Paulo', servers: 64, capacity: 89.7, status: 'operational' },
  ]);
  return (
    <div className="datacenters">
      <h1>Data Centers</h1>
      <p>Global data center status and capacity</p>
      <div className="dc-grid">
        {dcs.map(dc => (
          <div key={dc.id} className="dc-card">
            <h3>{dc.name}</h3>
            <p className="region">{dc.region}</p>
            <div className="metrics">
              <div>Servers: {dc.servers}</div>
              <div>Capacity: {dc.capacity}%</div>
              <div className="status"><UIIcon symbol="🟢" /> {dc.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
