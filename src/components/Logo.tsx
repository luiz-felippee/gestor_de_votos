// Logo: usa o PNG da urna. Um fundo azul (igual ao do ícone) cobre a margem
// transparente do PNG para não aparecer branco no header. O object-cover +
// leve scale recorta a sobra transparente. `iconClassName` controla o tamanho.
export function Logo({ iconClassName = "h-11 w-11" }: { className?: string, iconClassName?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-md ${iconClassName}`}
      style={{ backgroundColor: '#4f46e5' }}
    >
      <img
        src="/icon-192.png?v=3"
        alt="Gestor de Votos"
        className="h-full w-full scale-110 object-cover"
      />
    </div>
  )
}

