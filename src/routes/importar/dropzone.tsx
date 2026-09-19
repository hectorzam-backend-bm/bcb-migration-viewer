import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import type { FileRejection } from 'react-dropzone'
import { FileText, TriangleAlert, Upload } from 'lucide-react'
import { cn } from '~/lib/cn'
import { bytes } from '~/lib/format'
import type { Slot } from './steps'

/**
 * One dropzone per file slot — never one multi-file zone with filename
 * matching. Slots repeat across steps (`routes` feeds three endpoints) with
 * an unambiguous target each time, which a single zone with a matching
 * heuristic would trade for guesswork.
 *
 * `isDragReject` is intentionally unused: mid-drag, browsers (Finder on
 * macOS especially) often report an empty or wrong MIME type before the
 * drop completes, so it flags valid CSVs as rejected while still hovering.
 * Rejection is only painted from `onDrop`'s second argument, after the drop.
 */

const ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.ms-excel': ['.csv'], // what Finder reports when Excel is installed
  'application/csv': ['.csv'],
}

export function FileDrop({
  slot,
  file,
  disabled,
  onFile,
}: {
  slot: Slot
  file: File | null
  disabled?: boolean
  onFile: (file: File) => void
}) {
  const [rejection, setRejection] = useState<string | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    multiple: false,
    disabled,
    onDrop: (accepted: Array<File>, rejections: Array<FileRejection>) => {
      const first = accepted[0]
      if (first) {
        setRejection(null)
        onFile(first)
        return
      }
      const badFile = rejections[0]?.file
      setRejection(badFile ? `«${badFile.name}» no es un .csv y no se cargó.` : null)
    },
  })

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-sheet border border-dashed px-4 py-4 text-center',
          'transition-colors duration-100',
          disabled
            ? 'cursor-not-allowed border-rule-faint bg-sunken/50 opacity-60'
            : cn(
                'cursor-pointer',
                file
                  ? 'border-rule bg-sunken'
                  : isDragActive
                    ? 'border-stamp/60 bg-stamp-wash'
                    : 'border-rule-strong bg-sunken hover:border-ink-4',
              ),
        )}
      >
        <input {...getInputProps()} aria-label={`Elegir el archivo ${slot.legacyFile}`} />
        {file ? (
          <>
            <FileText size={16} strokeWidth={1.75} className="text-ink-3" aria-hidden />
            <span className="max-w-full truncate font-mono text-data text-ink">{file.name}</span>
            <span data-numeric className="font-mono text-note text-ink-4">
              {bytes(file.size)} · clic para reemplazar
            </span>
          </>
        ) : (
          <>
            <Upload size={16} strokeWidth={1.75} className="text-ink-4" aria-hidden />
            <span className="font-mono text-data text-ink-2">{slot.legacyFile}</span>
            <span className="text-note text-ink-3">{slot.label} — suelta o haz clic</span>
          </>
        )}
      </div>
      {rejection ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-note text-rust">
          <TriangleAlert size={11} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
          {rejection}
        </p>
      ) : null}
    </div>
  )
}
