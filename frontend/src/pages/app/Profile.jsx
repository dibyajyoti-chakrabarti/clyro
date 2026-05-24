export default function Profile() {
  return (
    <div className='space-y-5 text-[#F5F5F5]'>
      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-5xl font-semibold'>General</h2>
          <button type='button' className='text-sm font-semibold text-orange-500 underline underline-offset-2'>
            edit
          </button>
        </div>
        <div className='grid gap-3 text-sm md:grid-cols-[160px_1fr]'>
          <p className='text-[#737373]'>Name</p><p>XYZ</p>
          <p className='text-[#737373]'>Email-ID</p><p>example@mail.com</p>
          <p className='text-[#737373]'>Phone</p><p>+91 9876543210</p>
          <p className='text-[#737373]'>Subscription</p><p>Pro</p>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-[0_0_0_1px_#2A2A2A]'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-5xl font-semibold'>Account & Security</h2>
          <button type='button' className='text-sm font-semibold text-orange-500 underline underline-offset-2'>
            edit
          </button>
        </div>
        <div className='grid gap-3 text-sm md:grid-cols-[160px_1fr]'>
          <p className='text-[#737373]'>Change Password?</p>
          <button type='button' className='w-fit rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1 text-sm'>
            Change
          </button>
          <p className='text-[#737373]'>2FA</p>
          <button type='button' className='relative h-7 w-11 rounded-full border border-[#2A2A2A] bg-[#0E0E0E]'>
            <span className='absolute left-1 top-1 h-5 w-5 rounded-full bg-orange-500' />
          </button>
          <p className='text-[#737373]'>Active Sessions</p><p>3</p>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-[0_0_0_1px_#2A2A2A]'>
        <h2 className='mb-4 text-5xl font-semibold'>GitHub Integration</h2>
        <p className='mb-2 text-sm text-[#737373]'>Connected GitHub accounts</p>
        <div className='mb-4 rounded-md border border-[#2A2A2A]'>
          {['github-repo-1', 'github-repo-2'].map((repo) => (
            <div key={repo} className='flex items-center justify-between border-b border-[#2A2A2A] px-3 py-2 last:border-b-0'>
              <p className='text-sm'>{repo}</p>
              <button type='button' className='text-sm font-semibold text-orange-500 underline underline-offset-2'>
                edit
              </button>
            </div>
          ))}
        </div>
        <div className='grid gap-3 text-sm md:grid-cols-[200px_1fr]'>
          <p className='text-[#737373]'>Default branch preference</p>
          <div className='flex items-center justify-between gap-4'>
            <p>main</p>
            <button type='button' className='text-sm font-semibold text-orange-500 underline underline-offset-2'>
              edit
            </button>
          </div>
          <p className='text-[#737373]'>Add GitHub repository</p>
          <button type='button' className='w-fit rounded-md border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-1 text-sm'>
            Add
          </button>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-[0_0_0_1px_#2A2A2A]'>
        <h2 className='mb-4 text-5xl font-semibold'>Deployment Overview</h2>
        <div className='grid gap-3 text-sm md:grid-cols-[220px_1fr]'>
          <p className='text-[#737373]'>Active Deployments</p><p>9</p>
          <p className='text-[#737373]'>Last Deployed Project</p><p>ABC-Calculator (1300 UTC)</p>
          <p className='text-[#737373]'>Full deployment Page</p>
          <a href='/' className='w-fit text-orange-500 underline underline-offset-2'>quicklink.com</a>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-[0_0_0_1px_#2A2A2A]'>
        <h2 className='mb-4 text-5xl font-semibold'>Billing & Payments</h2>
        <div className='grid gap-3 text-sm md:grid-cols-[220px_1fr]'>
          <p className='text-[#737373]'>Current Plan</p>
          <div className='flex items-center gap-6'>
            <p>Free</p>
            <button type='button' className='font-semibold text-orange-500 underline underline-offset-2'>Upgrade</button>
          </div>
          <p className='text-[#737373]'>Next Billing Date & Amount</p>
          <div className='flex items-center gap-6'>
            <p>12th May, 2026</p>
            <p className='font-semibold text-orange-500 underline underline-offset-2'>456.87 INR</p>
          </div>
          <p className='text-[#737373]'>Payment method on file</p><p>Card</p>
          <p className='text-[#737373]'>Invoice History</p>
          <button type='button' className='w-fit font-semibold text-orange-500 underline underline-offset-2'>Access</button>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-[0_0_0_1px_#2A2A2A]'>
        <h2 className='mb-4 text-5xl font-semibold'>Preferences</h2>
        <div className='grid gap-4 text-sm md:grid-cols-[220px_1fr]'>
          <p className='text-[#737373]'>Default AWS region</p><p>ap-south-1 (Mumbai)</p>
          <p className='text-[#737373]'>Notification Settings</p>
          <div className='flex flex-wrap gap-6'>
            {['Deployment Successful', 'Deployment Failed', 'Cost Threshold'].map((item, index) => (
              <label key={item} className='space-y-1'>
                <button type='button' className='relative h-7 w-11 rounded-full border border-[#2A2A2A] bg-[#0E0E0E]'>
                  <span className={`absolute top-1 h-5 w-5 rounded-full ${index === 0 ? 'left-1 bg-orange-500' : 'right-1 bg-[#737373]'}`} />
                </button>
                <p className='w-24 text-xs text-[#737373]'>{item}</p>
              </label>
            ))}
          </div>
          <p className='text-[#737373]'>Theme</p>
          <button type='button' className='w-fit rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-4 py-1 text-sm'>
            Dark
          </button>
        </div>
      </section>

      <section className='rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-[0_0_0_1px_#2A2A2A]'>
        <h2 className='mb-4 text-5xl font-semibold'>Danger Zone</h2>
        <div className='grid gap-3 text-sm md:grid-cols-[160px_1fr]'>
          <p className='text-[#737373]'>Export Data</p>
          <button type='button' className='w-fit border border-red-500 px-3 py-1 font-semibold text-red-500'>
            Export
          </button>
          <p className='text-[#737373]'>Delete Account</p>
          <button type='button' className='w-fit border border-red-500 px-3 py-1 font-semibold text-red-500'>
            Delete
          </button>
        </div>
        <p className='mt-4 rounded-md border border-[#2A2A2A] bg-[#0E0E0E] px-3 py-2 text-center text-sm text-[#737373]'>
          Once you delete your account, all your deployments, architecture diagrams, billing history, and connected integrations will be permanently removed. This action cannot be undone.
        </p>
      </section>
    </div>
  )
}
