function estadoStyle(estado) {
  // Colores según prompt
  if (estado === "aprobada") return { background: "#A5D6A7" };
  if (estado === "habilitada") return { background: "#90CAF9" };
  if (estado === "bloqueada") return { background: "#EEEEEE" };
  return { background: "#EEEEEE" };
}

export default function MateriaCard({
  item,
  estado,
  checked,
  onToggle,
  onOpen,
  radarActive,
  flash,
  ariaPrefix = "",
}) {
  const style = {
    ...estadoStyle(estado),
    ...(radarActive || flash ? { outline: "2px solid rgba(255,193,7,0.9)", outlineOffset: 2 } : null),
  };

  return (
    <button
      type="button"
      className="mallaMateria"
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(item);
      }}
      aria-label={`${ariaPrefix}${item.materia}`}
    >
      <div className="mallaMateriaTop">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            e.stopPropagation();
            onToggle(item);
          }}
          aria-label={`${ariaPrefix}Marcar ${item.materia}`}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="mallaMateriaName">{item.materia}</div>
      </div>
    </button>
  );
}
