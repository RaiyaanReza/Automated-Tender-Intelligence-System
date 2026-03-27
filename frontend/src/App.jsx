import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';

// Feature Pages (Lazy loading for performance)
import { lazy, Suspense } from 'react';

// Lazy load pages for better initial load time
const Dashboard = lazy(() => import('./features/dashboard/DashboardView'));
const Tenders = lazy(() => import('./features/tenders/Tenders'));
const TenderDetails = lazy(() => import('./features/tenders/TenderDetails'));
const Analysis = lazy(() => import('./features/analysis/Analysis'));
const Documents = lazy(() => import('./features/documents/Documents'));
const Sources = lazy(() => import('./features/sources/Sources'));
const Alerts = lazy(() => import('./features/alerts/Alerts'));
const Settings = lazy(() => import('./features/settings/Settings'));

// Loading Component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Layout>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Dashboard />} />
          
          {/* Tender Management */}
          <Route path="/tenders" element={<Tenders />} />
          <Route path="/tenders/:id" element={<TenderDetails />} />
          
          {/* AI & Analysis */}
          <Route path="/analysis" element={<Analysis />} />
          
          {/* Documents & Sources */}
          <Route path="/documents" element={<Documents />} />
          <Route path="/sources" element={<Sources />} />
          
          {/* Notifications */}
          <Route path="/alerts" element={<Alerts />} />
          
          {/* Configuration */}
          <Route path="/settings" element={<Settings />} />
          
          {/* 404 Route */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </Suspense>
  );
}

// 404 Page Component
const NotFound = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
    <h1 className="text-6xl font-bold text-red-500 mb-4">404</h1>
    <p className="text-gray-400 text-lg mb-6">Page not found</p>
    <a
      href="/"
      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors"
    >
      Go to Dashboard
    </a>
  </div>
);

export default App;