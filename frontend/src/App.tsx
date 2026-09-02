import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { GlobalDashboard } from './pages/GlobalDashboard';
import { ProjectsList } from './pages/ProjectsList';
import { ProjectDetail } from './pages/ProjectDetail';
import { Requests } from './pages/Requests';
import { Tools } from './pages/Tools';
import { Skills } from './pages/Skills';
import { Sessions } from './pages/Sessions';
import { Clients } from './pages/Clients';
import { McpPlugins } from './pages/McpPlugins';
import { Settings } from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<GlobalDashboard />} />
          <Route path="/projects" element={<ProjectsList />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/tools" element={<Tools />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/mcp-plugins" element={<McpPlugins />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
