import githubFill from '../../assets/logos/github-fill.svg'

export default function GitHubLogo({ className = 'h-8 w-8', alt = 'GitHub' }) {
  return (
    <img
      src={githubFill}
      alt={alt}
      className={`${className} object-contain select-none`}
      draggable={false}
    />
  )
}
