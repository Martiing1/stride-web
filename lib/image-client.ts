/**
 * Compresión de imágenes en el navegador, antes de mandarlas a una Server
 * Action. Evita que una foto de celular de 4-6 MB viaje entera: se reescala
 * al lado máximo pedido y se recodifica en JPEG. Si el navegador no puede
 * decodificarla, devuelve el archivo original y la acción decide.
 *
 * Solo para componentes cliente (usa canvas y URL.createObjectURL).
 */
export function compressImage(
  file: File,
  { maxSide = 1600, quality = 0.82, skipUnderBytes = 900 * 1024 } = {}
): Promise<File> {
  return new Promise((resolve) => {
    const image = new window.Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      if (scale === 1 && file.size < skipUnderBytes) return resolve(file);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) =>
          resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file),
        "image/jpeg",
        quality
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    image.src = url;
  });
}

/** Fotos de perfil: 800 px de lado basta para un avatar y pesa ~100 KB. */
export const compressAvatar = (file: File) => compressImage(file, { maxSide: 800, quality: 0.85, skipUnderBytes: 250 * 1024 });
