import { useState } from 'react';
import { getRoutingHistory, removeRoutingHistory, RoutingHistoryEntry } from '../services/routing';
import './RoutingHistory.css';

export const RoutingHistory = () => {
  const [history, setHistory] = useState<RoutingHistoryEntry[]>(() => getRoutingHistory());
  const remove = (id: string) => setHistory(removeRoutingHistory(id));

  return <div className="routing-history">
    <header className="page-header">
      <h1>Routing History</h1>
      <p>Completed routing checks saved in this browser.</p>
    </header>
    <p className="routing-history-note">These records are local to this browser and are not a server-wide network audit log.</p>
    {history.length === 0 ? <section className="routing-history-empty"><h2>No routing checks saved</h2><p>Run an AS path lookup, BGP lookup, or local route table refresh to add an entry.</p></section> :
      <div className="routing-history-table-wrap"><table aria-label="Saved routing checks">
        <thead><tr><th>Time</th><th>Check</th><th>Input</th><th>Result</th><th>Actions</th></tr></thead>
        <tbody>{history.map(entry => <tr key={entry.id}>
          <td>{new Date(entry.observedAt).toLocaleString()}</td>
          <td>{entry.kind}</td>
          <td><code>{entry.input}</code></td>
          <td>{entry.summary}</td>
          <td><button type="button" aria-label={`Remove ${entry.kind} for ${entry.input}`} onClick={() => remove(entry.id)}>Remove</button></td>
        </tr>)}</tbody>
      </table></div>}
  </div>;
};
