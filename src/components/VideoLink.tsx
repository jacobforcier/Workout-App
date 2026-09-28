import { getExercise } from '../content'

/**
 * Opens the exercise's tutorial video in YouTube (a new tab/app), so an
 * in-progress workout stays where it is.
 */
export default function VideoLink({ exerciseId, compact = false }: { exerciseId: string; compact?: boolean }) {
  const exercise = getExercise(exerciseId)
  if (!exercise?.videoUrl) return null
  return (
    <a
      href={exercise.videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-2xl border-2 border-red-200 bg-red-50 text-red-950 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-50 ${compact ? 'min-h-12 p-2' : 'min-h-14 p-3'}`}
    >
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-lg text-white">
        ▶
      </span>
      <span className="min-w-0">
        <span className="block font-bold">Watch how (YouTube)</span>
        {!compact && exercise.videoTitle && <span className="block truncate text-sm opacity-80">{exercise.videoTitle}</span>}
      </span>
    </a>
  )
}
