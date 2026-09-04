import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Início', end: true },
  { to: '/errors', label: 'Erros' },
  { to: '/http', label: 'HTTP / Fetch' },
  { to: '/performance', label: 'Performance' },
  { to: '/behavior', label: 'Comportamento' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/concepts', label: 'O que é Telemetria' }
];

export function NavBar() {
  return (
    <nav className="navbar">
      <span className="navbar-brand">Telemetry SDK Demo</span>
      <div className="navbar-links">
        {links.map(({ to, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
