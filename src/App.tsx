import { PresenterPage } from './pages/PresenterPage';
import { ViewerHostPage } from './pages/ViewerHostPage';

/**
 * Main App component with simple route checking.
 * 
 * Routes:
 * - /viewer -> ViewerHostPage (for second window)
 * - / or other -> PresenterPage (main editing interface)
 */
function App() {
  const pathname = window.location.pathname;

  if (pathname === '/viewer') {
    return <ViewerHostPage />;
  }

  return <PresenterPage />;
}

export default App;
