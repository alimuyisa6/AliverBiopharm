export default function AuthRing({ size = 64 }) {
  const ringStyle = {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "2.5px solid transparent",
    animation: "alv-spin 1.3s cubic-bezier(.5,0,.5,1) infinite"
  };

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div style={{ ...ringStyle, borderTopColor: "#0a7e7e", animationDelay: "-.48s" }} />
      <div style={{ ...ringStyle, borderTopColor: "#0ab5b5", animationDelay: "-.32s", inset: size * 0.125 }} />
      <div style={{ ...ringStyle, borderTopColor: "#b8873a", animationDelay: "-.16s", inset: size * 0.25 }} />
      <div style={{ ...ringStyle, borderTopColor: "#c9a84c", inset: size * 0.375 }} />
    </div>
  );
}
