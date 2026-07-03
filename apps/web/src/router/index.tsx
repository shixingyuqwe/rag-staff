import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import MainLayout from '@/layouts/MainLayout';
import Assessment from '@/pages/Assessment';
import Logs from '@/pages/Logs';
import Scoring from '@/pages/Scoring';
import Upload from '@/pages/Upload';
import Welcome from '@/pages/Welcome';

const rootRoute = createRootRoute();

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: MainLayout,
});

const uploadRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/upload',
  component: Upload,
});

const scoringRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/scoring',
  component: Scoring,
});

const assessmentRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/assessment',
  component: Assessment,
});

const logsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/logs',
  component: Logs,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Welcome,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  layoutRoute.addChildren([uploadRoute, scoringRoute, assessmentRoute, logsRoute]),
]);

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.PUBLIC_PATH || '/',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
