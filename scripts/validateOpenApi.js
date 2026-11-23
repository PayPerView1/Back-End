const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { getMountedRoutes } = require('./openapiRouteInventory');

const specPath = path.resolve(__dirname, '../docs/openapi.yaml');
const spec = yaml.safeLoad(fs.readFileSync(specPath, 'utf8'));
const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const errors = [];
const routeKey = (method, apiPath) => `${method.toLowerCase()} ${apiPath}`;
const bodylessMutations = new Set([
  'post /auth/logout',
  'post /campaigns/{campaignId}/ai-review',
  'post /campaigns/drafts/{draftId}/ai-assistance',
  'put /campaigns/{campaignId}/pause',
  'put /campaigns/{campaignId}/resume',
  'put /campaigns/{campaignId}/auto-recharge',
  'patch /campaigns/{campaignId}/archive',
  'patch /campaigns/{campaignId}/restore',
  'patch /notifications/read-all',
  'patch /notifications/{id}/read',
  'post /applications/{id}/materials/download-all',
  'post /applications/{id}/materials/{materialId}/download-link',
  'post /reports/{id}/ai-triage',
  'delete /applications/{id}',
  'delete /campaigns/{campaignId}',
  'delete /campaigns/drafts/{draftId}',
  'delete /chat/threads/{threadId}',
  'delete /creator/payment-methods/{id}',
  'delete /favorites/{id}',
  'delete /submissions/{id}',
  'delete /wallet/refund/{id}',
]);

if (!/^3\.1\./.test(spec.openapi || '')) errors.push('OpenAPI version must be 3.1.x.');
if (!spec.info?.title || !spec.info?.version || !spec.servers?.length) errors.push('The specification needs info and a server base URL.');
if (!spec.components?.securitySchemes?.BearerAuth) errors.push('BearerAuth security scheme is missing.');

const documented = new Set();
const operationIds = new Set();
for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
  for (const [method, operation] of Object.entries(pathItem || {})) {
    if (!methods.has(method)) continue;
    const key = routeKey(method, apiPath);
    documented.add(key);
    if (!operation.summary || !operation.operationId || !operation.tags?.length) errors.push(`${key}: summary, operationId, or tags missing.`);
    if (operationIds.has(operation.operationId)) errors.push(`${key}: duplicate operationId ${operation.operationId}.`);
    operationIds.add(operation.operationId);
    if (!operation['x-roles']) errors.push(`${key}: x-roles permission metadata missing.`);
    if (!operation.responses || !Object.keys(operation.responses).length) errors.push(`${key}: no response codes documented.`);
    for (const [code, response] of Object.entries(operation.responses || {})) {
      if (!/^(default|[1-5][0-9]{2})$/.test(code)) errors.push(`${key}: invalid response status ${code}.`);
      if (!response.description && !response.$ref) errors.push(`${key}: response ${code} has no description.`);
    }
    for (const parameter of operation.parameters || []) {
      if (parameter.in === 'path' && parameter.required !== true) errors.push(`${key}: path parameter ${parameter.name} must be required.`);
    }
    const placeholders = [...apiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);
    for (const name of placeholders) {
      if (!(operation.parameters || []).some((parameter) => parameter.in === 'path' && parameter.name === name)) {
        errors.push(`${key}: path parameter {${name}} is undocumented.`);
      }
    }
    if (operation.security?.some((requirement) => Object.keys(requirement).includes('BearerAuth')) && !spec.components.securitySchemes.BearerAuth) {
      errors.push(`${key}: bearer security is referenced but not defined.`);
    }
    for (const [mediaType, media] of Object.entries(operation.requestBody?.content || {})) {
      if (!mediaType || !media.schema) errors.push(`${key}: request media type ${mediaType} has no schema.`);
    }
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      const bodyless = bodylessMutations.has(key);
      if (bodyless && operation.requestBody) errors.push(`${key}: a body is documented but this mounted route has no request body.`);
      if (!bodyless && !operation.requestBody) errors.push(`${key}: the request body contract is missing.`);
    }
    const roles = operation['x-roles'] || [];
    if (roles.length === 0 && key !== 'post /campaigns/{campaignId}/report' && operation.security?.length !== 0) {
      errors.push(`${key}: a public route must explicitly override the global bearer requirement.`);
    }
    if (roles.includes('PUBLIC') && !operation.security?.some((requirement) => Object.keys(requirement).length === 0)) {
      errors.push(`${key}: optional authentication must allow anonymous requests.`);
    }
    if (roles.length && !roles.includes('PUBLIC') && operation.security?.length === 0) {
      errors.push(`${key}: a protected route cannot disable the bearer requirement.`);
    }
  }
}

const mounted = new Set(getMountedRoutes().map((route) => routeKey(route.method, route.path)));
for (const route of mounted) if (!documented.has(route)) errors.push(`Mounted route is undocumented: ${route}.`);
for (const route of documented) if (!mounted.has(route)) errors.push(`OpenAPI operation is not a mounted route: ${route}.`);

function checkRefs(value, location = '$') {
  if (!value || typeof value !== 'object') return;
  if (typeof value.$ref === 'string') {
    const ref = value.$ref;
    if (!ref.startsWith('#/')) {
      errors.push(`${location}: external reference is not allowed: ${ref}`);
    } else {
      const parts = ref.slice(2).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
      const target = parts.reduce((current, part) => current?.[part], spec);
      if (target === undefined) errors.push(`${location}: unresolved reference ${ref}`);
    }
  }
  for (const [key, child] of Object.entries(value)) checkRefs(child, `${location}.${key}`);
}
checkRefs(spec);

const knownTags = new Set((spec.tags || []).map((tag) => tag.name));
for (const [apiPath, pathItem] of Object.entries(spec.paths || {})) {
  for (const [method, operation] of Object.entries(pathItem || {})) {
    if (methods.has(method)) for (const tag of operation.tags || []) if (!knownTags.has(tag)) errors.push(`${method.toUpperCase()} ${apiPath}: unknown tag ${tag}.`);
  }
}

if (errors.length) {
  process.stderr.write(`${errors.map((error) => `- ${error}`).join('\n')}\n`);
  process.exitCode = 1;
} else {
  const count = [...documented].length;
  process.stdout.write(`OpenAPI valid: ${count} operations across ${Object.keys(spec.paths).length} paths; all ${mounted.size} mounted routes are covered.\n`);
}
