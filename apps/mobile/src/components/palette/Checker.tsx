/**
 * Checkerboard drawn under translucent colors so alpha reads as alpha (the
 * web's `repeating-conic-gradient` 8px checker behind every chip).
 *
 * RN has no conic gradients, so the dark cells are Views. They are drawn only
 * for TRANSLUCENT colors — an opaque color covers the checker completely, so
 * skipping it there is visually identical and keeps a 32-swatch grid cheap.
 */
import { View } from 'react-native';

/** Half of the web's 8px checker tile. */
const CELL = 4;

export function Checker({ size, color }: { size: number; color: string }) {
  const count = Math.ceil(size / CELL);
  const cells = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = row % 2; col < count; col += 2) {
      cells.push(
        <View
          key={`${row}.${col}`}
          style={{
            position: 'absolute',
            top: row * CELL,
            left: col * CELL,
            width: CELL,
            height: CELL,
            backgroundColor: color,
          }}
        />,
      );
    }
  }
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      {cells}
    </View>
  );
}
