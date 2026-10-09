/** Every HTTP route the server exposes. The web app and the server both import these. */
export interface ApiRoutes {
  readonly info: '/api/info';
  readonly health: '/api/health';
  readonly repo: '/api/repo';
  readonly chat: '/api/chat';
}

export const API_ROUTES: ApiRoutes = {
  info: '/api/info',
  health: '/api/health',
  repo: '/api/repo',
  chat: '/api/chat',
};

export type ApiRoute = ApiRoutes[keyof ApiRoutes];
