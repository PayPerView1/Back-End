const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const router = express.Router();
const specPath = path.resolve(__dirname, '../../docs/openapi.yaml');
const openApiSpec = yaml.safeLoad(fs.readFileSync(specPath, 'utf8'));

if (!openApiSpec || !openApiSpec.openapi || !openApiSpec.paths) {
  throw new Error('Main Backend OpenAPI document is invalid or incomplete.');
}

router.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.json(openApiSpec);
});

router.get('/docs', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PayPerView Main Backend API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
  <style>html { box-sizing: border-box; overflow-y: scroll } *, *:before, *:after { box-sizing: inherit } body { margin: 0; background: #fafafa }</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui', deepLinking: true });
  </script>
</body>
</html>`);
});

router.get('/redoc', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PayPerView Main Backend API — ReDoc</title>
</head>
<body>
  <redoc spec-url="/openapi.json"></redoc>
  <script type="module" src="https://cdn.redoc.ly/redoc/v2.x/bundles/redoc.standalone.js"></script>
</body>
</html>`);
});

module.exports = router;
