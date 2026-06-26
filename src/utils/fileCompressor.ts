// src/utils/fileCompressor.ts

export async function compressImage(file: File, targetSizeKB: number = 100): Promise<File> {
  const targetBytes = targetSizeKB * 1024;

  if (file.size <= targetBytes) return file;

  const isImage = file.type.startsWith("image/");
  if (!isImage) {
    throw new Error(`Arquivo "${file.name}" não é uma imagem suportada.`);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      let width = img.width;
      let height = img.height;
      let quality = 0.9;

      const tryCompress = (): Promise<Blob> => {
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        return new Promise((res) => {
          canvas.toBlob((blob) => res(blob!), "image/jpeg", quality);
        });
      };

      const iterate = async () => {
        let attempts = 0;

        while (attempts < 20) {
          const blob = await tryCompress();

          if (blob.size <= targetBytes || attempts >= 19) {
            const compressed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, ".jpg"),
              { type: "image/jpeg" },
            );
            resolve(compressed);
            return;
          }

          if (quality > 0.3) {
            quality -= 0.1;
          } else {
            width = Math.floor(width * 0.85);
            height = Math.floor(height * 0.85);
            quality = 0.7;
          }

          attempts++;
        }
      };

      iterate().catch(reject);
    };

    img.onerror = () => reject(new Error("Erro ao carregar imagem."));
    img.src = objectUrl;
  });
}

export async function prepareFileForUpload(
  file: File,
  targetSizeKB: number = 100,
): Promise<{
  file: File;
  wasCompressed: boolean;
  originalSizeKB: number;
  finalSizeKB: number;
}> {
  const originalSizeKB = Math.round(file.size / 1024);

  if (file.type === "application/pdf") {
    const maxPDFSizeKB = 5 * 1024; // 5MB
    if (file.size > maxPDFSizeKB * 1024) {
      throw new Error("PDF muito grande. Envie arquivos menores que 5MB.");
    }
    return {
      file,
      wasCompressed: false,
      originalSizeKB,
      finalSizeKB: originalSizeKB,
    };
  }

  if (file.type.startsWith("image/")) {
    const compressed = await compressImage(file, targetSizeKB);
    const finalSizeKB = Math.round(compressed.size / 1024);
    return {
      file: compressed,
      wasCompressed: compressed.size < file.size,
      originalSizeKB,
      finalSizeKB,
    };
  }

  return {
    file,
    wasCompressed: false,
    originalSizeKB,
    finalSizeKB: originalSizeKB,
  };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
