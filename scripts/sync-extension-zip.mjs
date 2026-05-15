import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const projectRoot = process.cwd();
const outputDir = resolve(projectRoot, "apps/extension/.output");
const downloadsDir = resolve(projectRoot, "apps/web/public/downloads");
const outputZipPath = resolve(downloadsDir, "oddzone-extension.zip");

async function getLatestZipFile(pathToSearch) {
  const files = await readdir(pathToSearch);
  const zipCandidates = files.filter((file) => file.endsWith(".zip"));

  if (zipCandidates.length === 0) {
    throw new Error(
      "Nenhum arquivo .zip encontrado em apps/extension/.output. Rode `npm run zip:extension` antes."
    );
  }

  const withMetadata = await Promise.all(
    zipCandidates.map(async (filename) => {
      const fullPath = join(pathToSearch, filename);
      const metadata = await stat(fullPath);
      return { fullPath, mtime: metadata.mtimeMs };
    })
  );

  withMetadata.sort((a, b) => b.mtime - a.mtime);
  return withMetadata[0].fullPath;
}

async function main() {
  await mkdir(downloadsDir, { recursive: true });
  const latestZip = await getLatestZipFile(outputDir);
  await copyFile(latestZip, outputZipPath);
  console.log(`Arquivo atualizado: ${outputZipPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
