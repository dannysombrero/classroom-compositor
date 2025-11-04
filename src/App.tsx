import { PresenterPage } from './pages/PresenterPage';
import { ViewerHostPage } from './pages/ViewerHostPage';
import BottomBarLiveLite from "./components/BottomBarLiveLite";

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

export default function App() {
  return (
    <div className="h-full flex flex-col">
      {/* your app content */}
      <div className="mt-auto border-t">
        <div className="flex items-center justify-between px-3 py-2">
          <BottomBarLiveLite hostId="host-123" />
        </div>
      </div>
    </div>
  );
}