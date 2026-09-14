export type MarqueeItem = {
  slug: string
  label: string
  /** Simple Icons never shipped a stable SVG for this brand in our pinned sets */
  fallbackInitial?: string
  fallbackBg?: string
}

/** Logos via jsDelivr + simple-icons (see brand-icon-url.ts). */
export const MARQUEE_TECH: MarqueeItem[] = [
  { slug: 'googlecloud', label: 'Google Cloud' },
  { slug: 'amazonaws', label: 'AWS' },
  { slug: 'microsoftazure', label: 'Azure' },
  { slug: 'nodedotjs', label: 'Node.js' },
  { slug: 'python', label: 'Python' },
  { slug: 'react', label: 'React' },
  { slug: 'typescript', label: 'TypeScript' },
  { slug: 'docker', label: 'Docker' },
  { slug: 'kubernetes', label: 'Kubernetes' },
  { slug: 'postgresql', label: 'PostgreSQL' },
  { slug: 'stripe', label: 'Stripe' },
  { slug: 'vercel', label: 'Vercel' },
  { slug: 'nextdotjs', label: 'Next.js' },
  { slug: 'tailwindcss', label: 'Tailwind CSS' },
]

export const MARQUEE_AI: MarqueeItem[] = [
  { slug: 'openai', label: 'OpenAI' },
  { slug: 'anthropic', label: 'Anthropic' },
  { slug: 'googlegemini', label: 'Gemini' },
  { slug: 'meta', label: 'Meta' },
  { slug: 'huggingface', label: 'Hugging Face' },
  { slug: 'perplexity', label: 'Perplexity' },
  { slug: 'langchain', label: 'LangChain' },
  {
    slug: 'cohere',
    label: 'Cohere',
    fallbackInitial: 'C',
    fallbackBg: '#39414f',
  },
]
