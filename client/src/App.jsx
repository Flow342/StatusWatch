import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ServiceDetail from './pages/ServiceDetail.jsx';
import Login from './pages/Login.jsx';
import { useAuth } from './lib/auth.jsx';

export function App() {
  const { loading } = useAuth();

  // Wait for the stored token to be validated before painting, so an authenticated
  // reload doesn't flash the signed-out header.
  if (loading) {
    return <div className="grid min-h-screen place-items-center text-sm text-ink-muted">Loading…</div>;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
