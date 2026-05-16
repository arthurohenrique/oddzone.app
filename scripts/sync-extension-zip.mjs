import { copyFile, mkdir, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const projectRoot = process.cwd();
const outputDir = resolve(projectRoot, "apps/extension/.output");
const downloadsDir = resolve(projectRoot, "apps/web/public/downloads");
const outputZipPath = resolve(downloadsDir, "oddzone-extension.zip");

async function getLatestFileByExtension(pathToSearch, extension) {
  const files = await readdir(pathToSearch);
  const candidates = files.filter((file) => file.endsWith(extension));

  if (candidates.length === 0) {
    throw new Error(
      `Nenhum arquivo ${extension} encontrado em apps/extension/.output. Rode o release da extensao antes.`
    );
  }

  const withMetadata = await Promise.all(
    candidates.map(async (filename) => {
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
  const latestZip = await getLatestFileByExtension(outputDir, ".zip");

  await copyFile(latestZip, outputZipPath);

  console.log(`Arquivo atualizado: ${outputZipPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
