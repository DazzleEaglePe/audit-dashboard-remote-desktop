import { createBrowserRouter } from 'react-router-dom';
import Layout from './components/layout/Layout';
import KeysPage from './features/keys/KeysPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: '',
        element: <KeysPage />,
      },
    ],
  },
], {
  basename: '/admin'
});
