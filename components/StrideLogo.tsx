/**
 * Logo oficial entregado por STRIDE. El archivo maestro tiene un lienzo amplio;
 * el contenedor recorta visualmente ese espacio sin alterar la imagen original.
 */
export function StrideLogo({ large = false }: { large?: boolean }) {
  return (
    <span
      role="img"
      aria-label="STRIDE"
      className={`inline-block shrink-0 bg-no-repeat ${large ? "h-10 w-32" : "h-8 w-24"}`}
      style={{
        backgroundImage: "url('/stride_logo.png')",
        backgroundPosition: "center 46%",
        backgroundSize: large ? "390px auto" : "300px auto",
      }}
    />
  );
}
