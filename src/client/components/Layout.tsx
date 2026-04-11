import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';

interface LayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/dashboard', icon: '\u2302', label: 'Oversikt' },
    { path: '/archive', icon: '\u2610', label: 'Arkiv' },
  ];

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">DS</div>
          <div>
            <div className="sidebar-logo-text">Sprint Light</div>
            <div className="sidebar-logo-sub">Design Workshop</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Meny</div>
          {navItems.map(item => (
            <button
              key={item.path}
              className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">Fasilitator</div>
            </div>
          </div>
          <button
            className="sidebar-item"
            onClick={() => { logout(); navigate('/'); }}
            style={{ marginTop: '0.5rem' }}
          >
            <span className="icon">{'\u2190'}</span>
            Logg ut
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

interface WorkshopLayoutProps {
  children: React.ReactNode;
  workshopTitle?: string;
  workshopId?: string;
  joinCode?: string;
  currentStep?: string;
}

export function WorkshopLayout({ children, workshopTitle, workshopId, joinCode, currentStep }: WorkshopLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const navItems = [
    { path: '/dashboard', icon: '\u2190', label: 'Tilbake' },
  ];

  const workshopNav = workshopId ? [
    { path: `/workshop/${workshopId}/manage`, icon: '\u2630', label: 'Workshop' },
  ] : [];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">DS</div>
          <div>
            <div className="sidebar-logo-text">Sprint Light</div>
            <div className="sidebar-logo-sub">{workshopTitle || 'Workshop'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.path}
              className="sidebar-item"
              onClick={() => navigate(item.path)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </button>
          ))}

          {workshopNav.length > 0 && (
            <>
              <div className="sidebar-section-label">Workshop</div>
              {workshopNav.map(item => (
                <button
                  key={item.path}
                  className={`sidebar-item ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </>
          )}

          {joinCode && (
            <>
              <div className="sidebar-section-label">Deltakerkode</div>
              <div style={{ padding: '0.5rem 0.75rem' }}>
                <div className="join-code join-code-sm">{joinCode}</div>
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name}</div>
              <div className="sidebar-user-role">Fasilitator</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
