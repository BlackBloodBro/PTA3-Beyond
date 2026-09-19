-- [[Feature - Fully turn off LP]]: a per-Campaign switch to stop Loyalty Points from driving a
-- Pokemon's Loyalty tier, letting a GM set it manually instead. Deliberately NOT the usual
-- global-default-plus-override pattern used for shared reference data (exp_grant_events, loyalty
-- tiers, etc.) -- this app hosts other GMs' own real Campaigns (confirmed directly against live data),
-- and a naive global-default flip would silently change their games too. Instead this is a
-- creation-time snapshot on `campaigns` itself (like the existing `sell_price_percent` column): every
-- Campaign that exists *right now* gets backfilled to `false` (LP stays on, unchanged) before the
-- column's own default becomes `true`, so only Campaigns created from this point forward start with LP
-- off.
alter table campaigns add column lp_disabled boolean;

update campaigns set lp_disabled = false;

alter table campaigns alter column lp_disabled set not null;
alter table campaigns alter column lp_disabled set default true;
