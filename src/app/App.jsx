import { RouterProvider } from 'react-router';
import { RegistryProvider } from '../hooks/useRegistry';
import { NotificationsProvider } from '../hooks/useNotifications';
import { ToastProvider } from '../hooks/useToast';
import { router } from './routes';

export default function App() {
  return (
    <RegistryProvider>
      <NotificationsProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </NotificationsProvider>
    </RegistryProvider>
  );
}
