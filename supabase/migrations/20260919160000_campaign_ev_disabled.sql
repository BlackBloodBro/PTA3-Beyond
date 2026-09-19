-- [[Feature - Fully turn off EV's]]: a per-Campaign switch to exclude EVs from stat calculations. Same
-- creation-time-snapshot shape as campaigns.lp_disabled/exp_disabled (20260919130000/20260919140000) --
-- not a global-default flip, since this app hosts other real GMs' own Campaigns: every Campaign that
-- exists right now gets backfilled to `false` (EVs stay on, unchanged) before the column's own default
-- becomes `true`, so only Campaigns created from this point forward start with EVs off.
alter table campaigns add column ev_disabled boolean;

update campaigns set ev_disabled = false;

alter table campaigns alter column ev_disabled set not null;
alter table campaigns alter column ev_disabled set default true;
