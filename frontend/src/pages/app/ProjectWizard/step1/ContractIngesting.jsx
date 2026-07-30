import { Loader2 } from 'lucide-react'

// Reading CLYRO.md is a couple of GitHub calls, so this is on screen for ~2s.
// It replaced a seven-message scripted sequence on a 10s timer, which existed
// only to fill the old in-cloud scan's 17-41s AgentCore cold start.
export default function ContractIngesting({ selectedRepo, selectedBranch }) {
  return (
    <div className='flex h-full min-h-0 w-full items-center justify-center'>
      <div className='flex flex-col items-center gap-4 text-center'>
        <Loader2 className='h-6 w-6 animate-spin text-[#E8B84B]' strokeWidth={2.2} />
        <p className='text-[17px] font-semibold tracking-[-0.02em] text-white/85'>
          Reading CLYRO.md
        </p>
        <p className='max-w-[420px] text-[13.5px] leading-snug text-white/40'>
          <span className='font-mono text-white/60'>{selectedRepo}</span>
          {selectedBranch ? (
            <>
              {' '}on <span className='font-mono text-white/60'>{selectedBranch}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}
