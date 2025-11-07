import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import type { InsertFragment } from "@shared/schema";

const FRAGMENT_COUNT = 8;
const STORAGE_NODES = ["Node-A", "Node-B", "Node-C", "Node-D", "Node-E"];

interface LiquificationResult {
  fragments: InsertFragment[];
  encryptionKey: string;
}

export async function liquifyDocument(
  documentId: string,
  fileData: Buffer,
  fileName: string
): Promise<LiquificationResult> {
  // Generate encryption key
  const encryptionKey = randomBytes(32).toString("hex");
  const mainIv = randomBytes(16);

  // Encrypt the entire file first with random IV
  const cipher = createCipheriv("aes-256-cbc", Buffer.from(encryptionKey, "hex"), mainIv);
  const encryptedData = Buffer.concat([cipher.update(fileData), cipher.final()]);

  // Fragment the encrypted data
  const fragmentSize = Math.ceil(encryptedData.length / FRAGMENT_COUNT);
  const fragments: InsertFragment[] = [];

  for (let i = 0; i < FRAGMENT_COUNT; i++) {
    const start = i * fragmentSize;
    const end = Math.min(start + fragmentSize, encryptedData.length);
    const fragmentData = encryptedData.slice(start, end);

    // Secondary encryption for each fragment with unique IV
    const fragmentKey = createHash("sha256")
      .update(encryptionKey + i)
      .digest();
    const fragmentIv = randomBytes(16);
    const fragmentCipher = createCipheriv("aes-256-cbc", fragmentKey, fragmentIv);
    const doubleEncrypted = Buffer.concat([
      fragmentCipher.update(fragmentData),
      fragmentCipher.final(),
    ]);

    // Calculate checksum
    const checksum = createHash("sha256").update(doubleEncrypted).digest("hex");

    fragments.push({
      documentId,
      fragmentIndex: i,
      encryptedData: doubleEncrypted.toString("base64"),
      iv: fragmentIv.toString("hex"),
      node: STORAGE_NODES[i % STORAGE_NODES.length],
      checksum,
    });
  }

  // Store main IV with first fragment's IV (prepend it)
  if (fragments[0]) {
    fragments[0].iv = mainIv.toString("hex") + ":" + fragments[0].iv;
  }

  return { fragments, encryptionKey };
}

export async function reconstituteDocument(
  fragments: Array<{ fragmentIndex: number; encryptedData: string; iv: string }>,
  encryptionKey: string
): Promise<Buffer> {
  // Sort fragments by index
  const sortedFragments = fragments.sort((a, b) => a.fragmentIndex - b.fragmentIndex);

  // Extract main IV from first fragment
  const firstIvParts = sortedFragments[0].iv.split(":");
  const mainIv = Buffer.from(firstIvParts[0], "hex");
  
  // Update first fragment's IV
  if (firstIvParts[1]) {
    sortedFragments[0] = { ...sortedFragments[0], iv: firstIvParts[1] };
  }

  // Decrypt each fragment with its stored IV
  const decryptedFragments: Buffer[] = [];
  for (const fragment of sortedFragments) {
    const fragmentKey = createHash("sha256")
      .update(encryptionKey + fragment.fragmentIndex)
      .digest();
    const fragmentIv = Buffer.from(fragment.iv, "hex");
    const fragmentDecipher = createDecipheriv("aes-256-cbc", fragmentKey, fragmentIv);

    const fragmentBuffer = Buffer.from(fragment.encryptedData, "base64");
    const decrypted = Buffer.concat([
      fragmentDecipher.update(fragmentBuffer),
      fragmentDecipher.final(),
    ]);
    decryptedFragments.push(decrypted);
  }

  // Combine all fragments
  const combinedEncrypted = Buffer.concat(decryptedFragments);

  // Decrypt the combined data with main IV
  const decipher = createDecipheriv(
    "aes-256-cbc",
    Buffer.from(encryptionKey, "hex"),
    mainIv
  );
  const finalData = Buffer.concat([
    decipher.update(combinedEncrypted),
    decipher.final(),
  ]);

  return finalData;
}
