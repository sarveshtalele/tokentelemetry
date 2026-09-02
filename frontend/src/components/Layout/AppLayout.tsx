import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
  return (
    <div className="flex h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-7">
          <div className="max-w-app mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
