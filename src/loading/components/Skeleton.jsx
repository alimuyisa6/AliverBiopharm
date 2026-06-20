export default function Skeleton({ width = "100%", height = 14, borderRadius = 6, style = {} }) {
  return (
    <div className="alv-skeleton"
      style={{ width, height, borderRadius, ...style }}
      aria-hidden="true"
    />
  );
}
