import type { CatalogueExercise } from './index'

const P: Record<string, string> = {
  barbell: 'M2 12h20M5 7v10M8 9v6M16 9v6M19 7v10',
  'ez bar': 'M2 12h4l2-2 2 4 2-4 2 4 2-2h6M5 8v8M19 8v8',
  dumbbell: 'M8 12h8M5 8v8M8 7v10M16 7v10M19 8v8',
  kettlebell: 'M9 9V7a3 3 0 0 1 6 0v2M7.5 9h9l1.5 6a4 4 0 0 1-4 5h-4a4 4 0 0 1-4-5z',
  cable: 'M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 7v10M8 19h8M10 17l2 2 2-2',
  machine: 'M5 21V3M5 5h12v6M17 11v10M9 15h8M9 15v6',
  bodyweight: 'M12 2.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4M12 7v7M7 9.5h10M12 14l-3 7M12 14l3 7',
  band: 'M3 15c3-6 6 6 9 0s6 6 9 0M3 9v6M21 9v6',
  'medicine ball': 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M3 12h18M12 3v18',
  'exercise ball': 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M5 8c4 2 10 2 14 0',
  'foam roll': 'M6 8h12a2 4 0 0 1 0 8H6a2 4 0 0 1 0-8M6 8a2 4 0 0 0 0 8',
  cardio: 'M2 12h4l2-5 4 10 3-8 2 3h5',
  other: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M8 12h8M12 8v8',
}

export default function EquipIcon({ e, size = 28 }: { e: Pick<CatalogueExercise, 'eq' | 'c'>; size?: number }) {
  const d = (e.c === 'cardio' ? P.cardio : P[e.eq]) ?? P.other
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  )
}
