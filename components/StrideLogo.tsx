import Image from "next/image";

/** Logo oficial, recortado sobre transparencia para no depender del fondo. */
export function StrideLogo({ large = false }: { large?: boolean }) {
  return (
    <Image
      src="/stride_logo_clean.png"
      alt="STRIDE"
      width={1200}
      height={414}
      priority={!large}
      className={`block h-auto shrink-0 object-contain ${large ? "w-36" : "w-28"}`}
    />
  );
}
