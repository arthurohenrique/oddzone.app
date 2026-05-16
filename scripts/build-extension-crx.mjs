import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import crx3 from "crx3";

const projectRoot = process.cwd();
const extensionDir = resolve(projectRoot, "apps/extension");
const outputDir = resolve(extensionDir, ".output");
const builtManifestPath = resolve(outputDir, "chrome-mv3/manifest.json");
const extensionPackagePath = resolve(extensionDir, "package.json");
const crxOutputPath = resolve(outputDir, "oddzone-extension.crx");
const xmlOutputPath = resolve(outputDir, "oddzone-extension-updates.xml");

const downloadBaseUrl =
  process.env.ODDZONE_EXTENSION_DOWNLOAD_BASE_URL ??
  "https://oddzone.vercel.app/downloads";
const crxUrl =
  process.env.ODDZONE_EXTENSION_CRX_URL ??
  `${downloadBaseUrl}/oddzone-extension.crx`;

function normalizePem(privateKeyEnv) {
  return privateKeyEnv.replace(/\\n/g, "\n").trim();
}

async function resolvePrivateKeyPath() {
  const envKey = process.env.ODDZONE_EXTENSION_PRIVATE_KEY;
  if (envKey) {
    const tempDir = await mkdtemp(join(tmpdir(), "oddzone-extension-key-"));
    const keyPath = resolve(tempDir, "oddzone-extension.pem");
    await writeFile(keyPath, `${normalizePem(envKey)}\n`, "utf8");
    return { keyPath, tempDir };
  }

  const pathFromEnv = process.env.ODDZONE_EXTENSION_PRIVATE_KEY_PATH;
  if (!pathFromEnv) {
    throw new Error(
      "Defina ODDZONE_EXTENSION_PRIVATE_KEY ou ODDZONE_EXTENSION_PRIVATE_KEY_PATH para assinar o CRX."
    );
  }

  return { keyPath: resolve(projectRoot, pathFromEnv), tempDir: null };
}

function extensionIdFromPublicKey(publicKeyBase64) {
  const hash = createHash("sha256")
    .update(Buffer.from(publicKeyBase64, "base64"))
    .digest("hex")
    .slice(0, 32);

  return Array.from(hash, (char) =>
    String.fromCharCode("a".charCodeAt(0) + parseInt(char, 16))
  ).join("");
}

async function readExtensionVersion() {
  const packageRaw = await readFile(extensionPackagePath, "utf8");
  const packageJson = JSON.parse(packageRaw);
  if (!packageJson.version || typeof packageJson.version !== "string") {
    throw new Error("Versao da extensao nao encontrada em apps/extension/package.json.");
  }
  return packageJson.version;
}

async function main() {
  const publicKey =
    process.env.ODDZONE_EXTENSION_PUBLIC_KEY ?? process.env.WXT_PUBLIC_EXTENSION_KEY;

  if (!publicKey) {
    throw new Error(
      "Defina ODDZONE_EXTENSION_PUBLIC_KEY (ou WXT_PUBLIC_EXTENSION_KEY) para gerar appid do update manifest."
    );
  }

  const { keyPath, tempDir } = await resolvePrivateKeyPath();
  const extensionVersion = await readExtensionVersion();
  const extensionId = extensionIdFromPublicKey(publicKey);

  try {
    await crx3([builtManifestPath], {
      keyPath,
      crxPath: crxOutputPath,
      xmlPath: xmlOutputPath,
      appVersion: extensionVersion,
      crxURL: crxUrl
    });
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  const xmlRaw = await readFile(xmlOutputPath, "utf8");
  const xmlWithAppId = xmlRaw.replace(
    /appid="[^"]*"/g,
    `appid="${extensionId}"`
  );
  await writeFile(xmlOutputPath, xmlWithAppId, "utf8");

  console.log(`CRX gerado em: ${crxOutputPath}`);
  console.log(`Update manifest gerado em: ${xmlOutputPath}`);
  console.log(`Extension ID (estavel): ${extensionId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
