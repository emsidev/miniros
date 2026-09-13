import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const version = (await readFile(".next/BUILD_ID", "utf8")).trim();
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : path.join(directory, entry.name),
      ),
    )
  ).flat();
}
const assets = (await files(".next/static"))
  .filter((file) => /\.(js|css|woff2?)$/.test(file))
  .map((file) => "/_next/" + file.replace(/^\.next\//, ""));
await mkdir("public", { recursive: true });
// A frozen public shell makes repair verifiable across a deployment change.
const html = await readFile(".next/server/app/offline.html", "utf8");
const shellBuild = html.replaceAll('\\"', '"').match(/"b":"([\w-]+)"/)?.[1];
if (shellBuild !== version || !html.includes("</head>"))
  throw new Error("Public offline shell does not match the production build");
const shell = html.replace(
  "</head>",
  `<meta name="miniros-build" content="${version}"></head>`,
);
await writeFile("public/pwa-shell.html", shell);
await writeFile(
  "public/pwa-assets.json",
  JSON.stringify({ version, assets, shell: "/pwa-shell.html" }),
);
await writeFile(
  "public/sw.js",
  (await readFile("pwa/sw.js", "utf8"))
    .replaceAll("__BUILD_ID__", version)
    .replace(
      "const ASSETS = null;",
      `const ASSETS = ${JSON.stringify(assets)};`,
    ),
);
console.log(
  `PWA ${version}: ${assets.length} static assets; private pages excluded.`,
);
