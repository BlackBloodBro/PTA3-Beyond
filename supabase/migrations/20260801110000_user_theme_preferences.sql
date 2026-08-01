-- Theme preferences: two independent, nullable axes. Null = no override -- the app falls through
-- to :root's CSS defaults, which are today's exact literal colors, so an unset preference is
-- indistinguishable from a pre-Themes user. Reuses lib/pta3/labelColors.ts's exact 13-name palette
-- for theme_accent (deliberately not a new palette), mirroring campaign_labels.color's
-- CHECK-constraint style.
alter table users
  add column theme_mode text check (theme_mode in ('light', 'dark')),
  add column theme_accent text check (
    theme_accent in ('red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'pink', 'gray')
  );
