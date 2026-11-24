import { BGPRouteLookup } from '../components/BGPRouteLookup';

export const ASPathAnalysis = () => <BGPRouteLookup
  pageClass="as-path-analysis"
  title="AS Path Analysis"
  description="Look up observed AS paths for an IP address or network prefix."
  tool="as-path-analysis"
  historyKind="AS path lookup"
/>;
