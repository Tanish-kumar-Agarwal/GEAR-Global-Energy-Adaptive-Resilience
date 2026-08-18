import networkx as nx
import copy

class SupplyChainSimulator:
    def __init__(self, baseline_flows):
        """
        Builds a directed NetworkX graph representing the baseline supply chain.
        baseline_flows: list of dicts with supplier, route, chokepoint, destination, volume.
        """
        self.graph = nx.DiGraph()
        self.baseline_flows = baseline_flows
        self._build_graph()

    def _build_graph(self):
        for flow in self.baseline_flows:
            s = flow['supplier']
            c = flow['chokepoint']
            d = flow['destination']
            v = flow['volume']
            
            # Edges: Supplier -> Chokepoint -> Destination
            if self.graph.has_edge(s, c):
                self.graph[s][c]['capacity'] += v
            else:
                self.graph.add_edge(s, c, capacity=v)
                
            if self.graph.has_edge(c, d):
                self.graph[c][d]['capacity'] += v
            else:
                self.graph.add_edge(c, d, capacity=v)
                
            # Node metadata
            self.graph.nodes[d]['demand'] = self.graph.nodes[d].get('demand', 0) + v

    def simulate_disruption(self, chokepoint_id: str, severity: float):
        """
        severity: 0.0 to 1.0 (1.0 = completely blocked)
        """
        sim_graph = copy.deepcopy(self.graph)
        
        # 1. Reduce capacity at chokepoint
        if chokepoint_id in sim_graph:
            for pred in sim_graph.predecessors(chokepoint_id):
                sim_graph[pred][chokepoint_id]['capacity'] *= (1 - severity)
            for succ in sim_graph.successors(chokepoint_id):
                sim_graph[chokepoint_id][succ]['capacity'] *= (1 - severity)

        # 2. Run max-flow to determine new reachable supply
        # We need a super-source and super-sink for max_flow calculation
        sim_graph.add_node('SUPER_SOURCE')
        sim_graph.add_node('SUPER_SINK')
        
        for n in sim_graph.nodes:
            if n not in ('SUPER_SOURCE', 'SUPER_SINK'):
                if sim_graph.in_degree(n) == 0:
                    sim_graph.add_edge('SUPER_SOURCE', n, capacity=float('inf'))
                if sim_graph.out_degree(n) == 0:
                    demand = sim_graph.nodes[n].get('demand', 0)
                    sim_graph.add_edge(n, 'SUPER_SINK', capacity=demand)

        flow_value, flow_dict = nx.maximum_flow(sim_graph, 'SUPER_SOURCE', 'SUPER_SINK', capacity='capacity')
        
        # 3. Calculate impacts
        impacts = {}
        for node in self.graph.nodes:
            if self.graph.out_degree(node) == 0: # It's a destination
                original_demand = self.graph.nodes[node].get('demand', 0)
                new_supply = sum(flow_dict[pred][node] for pred in sim_graph.predecessors(node) if pred != 'SUPER_SOURCE')
                gap = original_demand - new_supply
                impacts[node] = {
                    "original_supply": original_demand,
                    "new_supply": new_supply,
                    "supply_gap": gap,
                    "stress_level": gap / original_demand if original_demand > 0 else 0
                }
                
        return {
            "total_flow": flow_value,
            "impacts": impacts
        }
