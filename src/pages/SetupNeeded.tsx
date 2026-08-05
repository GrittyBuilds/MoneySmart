import { Database, ExternalLink } from 'lucide-react'

export default function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5 py-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-xl font-black text-slate-950">
          $
        </div>
        <div>
          <h1 className="text-xl font-bold">MoneySmart</h1>
          <p className="text-sm text-slate-400">Let's connect your Supabase project.</p>
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <div className="flex items-center gap-2 text-brand-300">
          <Database className="h-5 w-5" />
          <h2 className="font-semibold">Almost there</h2>
        </div>
        <p className="text-sm text-slate-300">
          MoneySmart stores your family's budget in your own free{' '}
          <a
            href="https://supabase.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-brand-400 underline"
          >
            Supabase <ExternalLink className="h-3 w-3" />
          </a>{' '}
          project so it syncs across every device. Set it up once:
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-300">
          <li>
            Create a project at supabase.com, then open the{' '}
            <span className="font-medium text-slate-100">SQL editor</span>.
          </li>
          <li>
            Paste and run the contents of{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-brand-300">
              supabase/schema.sql
            </code>{' '}
            from this repo.
          </li>
          <li>
            Copy the file{' '}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-brand-300">.env.example</code>{' '}
            to <code className="rounded bg-slate-800 px-1.5 py-0.5 text-brand-300">.env</code> and
            fill in your project URL and anon key (Project Settings → API).
          </li>
          <li>
            Restart the dev server (<code className="rounded bg-slate-800 px-1.5 py-0.5">npm run dev</code>).
          </li>
        </ol>
        <p className="text-xs text-slate-500">
          The anon key is safe to ship in the app — Row Level Security in the schema keeps each
          household's data private.
        </p>
      </div>
    </div>
  )
}
