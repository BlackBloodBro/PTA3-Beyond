alter table campaigns
  add column sell_price_percent int not null default 50
    check (sell_price_percent >= 0 and sell_price_percent <= 100);
