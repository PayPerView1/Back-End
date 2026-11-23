const fs = require('fs');
const path = require('path');

const ROUTER_MOUNTS = {
  'admin/submissionAdmin.routes.js': ['/api/v1'],
  'admin/walletAdmin.routes.js': ['/api/v1/admin/wallet'],
  'admin/withdrawalAdmin.routes.js': ['/api/v1'],
  'ai/chat.routes.js': ['/api/v1/chat'],
  'ai/intelligence.routes.js': ['/api/v1'],
  'application/application.routes.js': ['/api/v1'],
  'authRoutes.js': ['/api/v1/auth'],
  'campaign/campaignCategory.routes.js': ['/api/v1/campaigns/categories', '/api/v1/categories'],
  'campaign/campaignCreation.routes.js': ['/api/v1/campaigns'],
  'campaign/campaignDiscovery.routes.js': ['/api/v1'],
  'campaign/campaignDraft.routes.js': ['/api/v1/campaigns/drafts'],
  'campaign/campaignManagement.routes.js': ['/api/v1/campaigns'],
  'creator/creatorPreferences.routes.js': ['/api/v1/creator/preferences'],
  'creator/favorite.routes.js': ['/api/v1/favorites'],
  'material/material.routes.js': ['/api/v1'],
  'moderation/report.routes.js': ['/api/v1'],
  'notification/notification.routes.js': ['/api/v1/notifications'],
  'profileRoutes.js': ['/api/v1/profile'],
  'submission/submission.routes.js': ['/api/v1'],
  'submission/submissionViews.routes.js': ['/api/v1'],
  'wallet/campaignBudget.routes.js': ['/api/v1/campaigns/{campaignId}'],
  'wallet/creatorEarnings.routes.js': ['/api/v1'],
  'wallet/transactionHistory.routes.js': ['/api/v1/wallet/transactions'],
  'wallet/walletFunding.routes.js': ['/api/v1/wallet'],
  'wallet/walletRefund.routes.js': ['/api/v1/wallet'],
};

const ROOT = path.resolve(__dirname, '..');
const ROUTES_ROOT = path.join(ROOT, 'src', 'routes');
const ROUTE_CALL_PATTERN = /router\.(get|post|put|patch|delete)\s*\(/g;
const UNMOUNTED_ROUTERS = new Set(['wallet/walletAdmin.routes.js', 'docs.routes.js']);

function stripComments(source) {
  let result = '';
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === '\n') {
        lineComment = false;
        result += character;
      } else {
        result += ' ';
      }
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        result += '  ';
        index += 1;
      } else {
        result += character === '\n' ? '\n' : ' ';
      }
      continue;
    }
    if (quote) {
      result += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      result += character;
    } else if (character === '/' && next === '/') {
      lineComment = true;
      result += '  ';
      index += 1;
    } else if (character === '/' && next === '*') {
      blockComment = true;
      result += '  ';
      index += 1;
    } else {
      result += character;
    }
  }
  return result;
}

function readQuoted(source, index) {
  const quote = source[index];
  let value = '';
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (character === '\\') {
      value += source[cursor + 1] || '';
      cursor += 1;
    } else if (character === quote) {
      return { value, next: cursor + 1 };
    } else {
      value += character;
    }
  }
  throw new Error('Unterminated route path string');
}

function readRoutePaths(source, index) {
  while (/\s/.test(source[index] || '')) index += 1;
  if (source[index] === '[') {
    const paths = [];
    index += 1;
    while (index < source.length) {
      while (/[\s,]/.test(source[index] || '')) index += 1;
      if (source[index] === ']') return { paths, next: index + 1 };
      if (source[index] !== "'" && source[index] !== '"') {
        throw new Error(`Unsupported route path array syntax near: ${source.slice(index, index + 30)}`);
      }
      const parsed = readQuoted(source, index);
      paths.push(parsed.value);
      index = parsed.next;
    }
    throw new Error('Unterminated route path array');
  }
  if (source[index] === "'" || source[index] === '"') {
    const parsed = readQuoted(source, index);
    return { paths: [parsed.value], next: parsed.next };
  }
  throw new Error(`Unsupported route path syntax near: ${source.slice(index, index + 30)}`);
}

function normalizedPath(prefix, routePath) {
  const fullPath = routePath === '/'
    ? prefix
    : `${prefix.replace(/\/$/, '')}/${routePath.replace(/^\//, '')}`;
  const apiPrefix = '/api/v1';
  const relative = fullPath.startsWith(apiPrefix) ? fullPath.slice(apiPrefix.length) || '/' : fullPath;
  return relative.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function getMountedRoutes() {
  const routes = new Map();
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && (entry.name.endsWith('.routes.js') || entry.name.endsWith('Routes.js'))) files.push(absolute);
    }
  };
  visit(ROUTES_ROOT);

  for (const file of files) {
    const relativeFile = path.relative(ROUTES_ROOT, file).replace(/\\/g, '/');
    const mounts = ROUTER_MOUNTS[relativeFile];
    if (!mounts) {
      if (UNMOUNTED_ROUTERS.has(relativeFile)) continue;
      throw new Error(`No OpenAPI mount mapping for ${relativeFile}`);
    }
    const source = stripComments(fs.readFileSync(file, 'utf8'));
    ROUTE_CALL_PATTERN.lastIndex = 0;
    for (const match of source.matchAll(ROUTE_CALL_PATTERN)) {
      const method = match[1].toLowerCase();
      const { paths: routePaths } = readRoutePaths(source, match.index + match[0].length);
      for (const mount of mounts) {
        for (const routePath of routePaths) {
          const openApiPath = normalizedPath(mount, routePath);
          const key = `${method} ${openApiPath}`;
          routes.set(key, { method, path: openApiPath, source: relativeFile });
        }
      }
    }
  }

  // This is the one direct Express route outside the mounted routers.
  routes.set('get /', { method: 'get', path: '/', source: 'src/app.js' });
  return [...routes.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

module.exports = { getMountedRoutes };
