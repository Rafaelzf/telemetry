import { Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { HomePage } from './pages/HomePage';
import { ErrorsPage } from './pages/ErrorsPage';
import { HttpPage } from './pages/HttpPage';
import { PerformancePage } from './pages/PerformancePage';
import { BehaviorPage } from './pages/BehaviorPage';

export default function App() {
  return (
    <div className="app">
      <NavBar />
      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/errors" element={<ErrorsPage />} />
          <Route path="/http" element={<HttpPage />} />
          <Route path="/performance" element={<PerformancePage />} />
          <Route path="/behavior" element={<BehaviorPage />} />
        </Routes>
      </main>
    </div>
  );
}
