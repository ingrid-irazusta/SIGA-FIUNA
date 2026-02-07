import MateriaCard from "./MateriaCard";

export default function SemestreColumn({
  semestre,
  items,
  estados,
  aprobadasSet,
  onToggle,
  onOpen,
  radarKeys,
  flashKeys,
}) {
  return (
    <div className="mallaSemestre">
      <div className="mallaSemestreHeader">
        <div style={{ fontWeight: 900 }}>{semestre}° semestre</div>
      </div>

      <div className="mallaSemestreList">
        {items.map((it) => (
          <MateriaCard
            key={it.key}
            item={it}
            estado={estados.get(it.key)}
            checked={aprobadasSet.has(it.key)}
            onToggle={onToggle}
            onOpen={onOpen}
            radarActive={radarKeys.has(it.key)}
            flash={flashKeys.has(it.key)}
          />
        ))}
      </div>
    </div>
  );
}
