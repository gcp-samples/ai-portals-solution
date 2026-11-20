import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "fs";
import { join, basename } from "path";

const ROOT_DIR = join(import.meta.dir, "..");
const PUBLIC_DIR = join(ROOT_DIR, "public");
const VIEWS_DIR = join(PUBLIC_DIR, "views");
const DIST_DIR = join(ROOT_DIR, "dist");
const PROXY_YAML_PATH = join(ROOT_DIR, "proxies", "REST-Portals.yaml");

// Collect FRONTEND_* environment variables and map to camelCase CONFIG properties
const frontendConfig = {
  demoMode: false,
  portalId: "demo",
  apiHost: "",
  oidcEndpoint: "",
  clientId: "",
};

for (const [envKey, envVal] of Object.entries(process.env)) {
  if (!envKey.startsWith("FRONTEND_") || envVal === undefined) continue;
  const propName = envKey
    .replace(/^FRONTEND_/, "")
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (envVal === "true") {
    frontendConfig[propName] = true;
  } else if (envVal === "false") {
    frontendConfig[propName] = false;
  } else {
    frontendConfig[propName] = envVal;
  }
}

const buildResult = await Bun.build({
  entrypoints: [join(PUBLIC_DIR, "app.js"), join(PUBLIC_DIR, "styles.css")],
  minify: true,
  target: "browser",
  define: {
    __FRONTEND_CONFIG__: JSON.stringify(frontendConfig),
  },
});

if (!buildResult.success) {
  for (const log of buildResult.logs) {
    console.error(log);
  }
  process.exit(1);
}

let bundledJs = "";
let bundledCss = "";
for (const output of buildResult.outputs) {
  const text = await output.text();
  if (output.path.endsWith(".js")) {
    bundledJs = text;
  } else if (output.path.endsWith(".css")) {
    bundledCss = text;
  }
}

const views = {};
for (const file of readdirSync(VIEWS_DIR)) {
  if (file.endsWith(".html")) {
    const viewName = basename(file, ".html");
    views[viewName] = readFileSync(join(VIEWS_DIR, file), "utf8");
  }
}

let indexHtml = readFileSync(join(PUBLIC_DIR, "index.html"), "utf8");

// Escape </ inside <script> blocks so embedded HTML/JS cannot prematurely close the tag
const escapeScriptContent = (str) => str.replace(/<\//g, "<\\/");

const inlineBootScript = `<script>window.__BUNDLED_VIEWS__=${escapeScriptContent(JSON.stringify(views))};</script>`;
const inlineAppScript = `<script>${escapeScriptContent(bundledJs)}</script>`;
const inlineStyle = `<style>${bundledCss}</style>`;

indexHtml = indexHtml.replace(
  /<link\s+rel="stylesheet"\s+href="\.\/styles\.css"\s*\/?>/,
  () => inlineStyle,
);
indexHtml = indexHtml.replace(
  /<script\s+src="\.\/app\.js"><\/script>/,
  () => `${inlineBootScript}\n    ${inlineAppScript}`,
);

mkdirSync(DIST_DIR, { recursive: true });
const outHtmlPath = join(DIST_DIR, "portal.html");
writeFileSync(outHtmlPath, indexHtml, "utf8");
console.log(`Built single-file portal HTML: ${outHtmlPath} (${indexHtml.length} bytes)`);

// Update portal-html.js resource in proxies/REST-Portals.yaml
const proxyYaml = readFileSync(PROXY_YAML_PATH, "utf8");
const resourcePattern = /(- name: portal-html\.js\n\s+type: jsc\n\s+content: )(?:\|\n[\s\S]*?|"[^\n]*")(\ntests:)/;
if (!resourcePattern.test(proxyYaml)) {
  console.error("Could not find portal-html.js resource block in proxies/REST-Portals.yaml");
  process.exit(1);
}

const jsResourceLine = `|\n      var PORTAL_HTML = ${JSON.stringify(indexHtml)};\n`;
let updatedYaml = proxyYaml.replace(
  resourcePattern,
  (_match, header, footer) => `${header}${jsResourceLine}${footer}`,
);
if (process.env.GOOGLE_CLOUD_LOCATION) {
  updatedYaml = updatedYaml.replace(
    /(APIHUB_LOCATION=)[^\s\n]+/,
    `$1${process.env.GOOGLE_CLOUD_LOCATION}`,
  );
}
writeFileSync(PROXY_YAML_PATH, updatedYaml, "utf8");
console.log(`Updated portal-html.js resource in ${PROXY_YAML_PATH}`);
