export default function Card({ title, right, children, className = "" }) {
  return (
    <section className={`card ${className}`.trim()}>
      <div className="cardPad">
        {(title || right) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
            <h2 className="h2">{title}</h2>
            {right}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}
