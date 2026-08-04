import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-bg)',
        foreground: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        'surface-subtle': 'var(--color-surface-subtle)',
        'surface-muted': 'var(--color-surface-muted)',
        danger: 'var(--color-danger)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        // rgb(var(...) / <alpha-value>) rather than a plain hex var -- lets bg-accent/10 etc. work
        // for the one existing tinted-card call-site, without a separate tinted-surface token.
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--color-accent-foreground) / <alpha-value>)',
        // A plain var(...), not the rgb(.../<alpha-value>) pattern -- color-mix() already produces a
        // full resolved color, not a bare RGB triplet, so it can't compose with an opacity modifier.
        'accent-dark': 'var(--color-accent-dark)',
      },
      borderColor: {
        // Tailwind's Preflight resets every element's border-color to this -- overriding it here
        // means every bare `border`/`border-t`/`border-b` utility re-themes for free, no per-file
        // class change needed.
        DEFAULT: 'var(--color-border)',
      },
    },
  },
  plugins: [],
};

export default config;
