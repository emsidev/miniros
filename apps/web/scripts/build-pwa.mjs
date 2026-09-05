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
await writeFile("public/pwa-assets.json", JSON.stringify({ version, assets }));
await writeFile(
  "public/sw.js",
  (await readFile("pwa/sw.js", "utf8")).replaceAll("__BUILD_ID__", version),
);
console.log(
  `PWA ${version}: ${assets.length} static assets; private pages excluded.`,
);
