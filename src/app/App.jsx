import { RouterProvider } from 'react-router';
import { RegistryProvider } from '../hooks/useRegistry';
import { ToastProvider } from '../hooks/useToast';
import { router } from './routes';

export default function App() {
  return (
    <RegistryProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </RegistryProvider>
  );
}
