/**
 * Where a tapped notification opens (push.ts), as plain logic with no Expo
 * modules, so the website's test suite runs it (tests/mobile-logic.test.ts).
 */

/** A screen to open: a path, or a dynamic route with its params (push.ts hands it to expo-router). */
export type RouteHref = string | { pathname: string; params: Record<string, string> };

/** A notification's web path (from the server) as a screen in this app. */
export function routeFor(url: string | undefined): RouteHref | null {
  if (!url) return null;
  const [path, query = ''] = url.split('?');
  const id = new URLSearchParams(query).get('id');
  // App paths, as the sample and newer notices send them.
  if (path && /^\/(home|project|site|geio|me|chats|snags|locker|notifications)$/.test(path)) return path;
  /* In-app chat (1 Nov 2026): a message opens its conversation. */
  const chat = /^\/app\/chats\/(designer|team|one_interiors)$/.exec(path ?? '');
  const project = new URLSearchParams(query).get('project');
  if (chat && project) return { pathname: '/chat/[projectId]/[kind]', params: { projectId: project, kind: chat[1]!.toUpperCase() } };
  if (path === '/app/chats' || chat) return '/chats';
  const decision = /^\/decision\/([^/]+)$/.exec(path ?? '');
  if (decision) return { pathname: '/decision/[id]', params: { id: decision[1]! } };
  switch (path) {
    case '/app/project':
      return '/project';
    case '/app/site':
      return '/site';
    case '/app/snags':
      return '/snags';
    case '/app/locker':
      return '/locker';
    case '/app/decision':
      return id ? { pathname: '/decision/[id]', params: { id } } : '/home';
    default:
      return path?.startsWith('/app') ? '/home' : null;
  }
}
