-- Evolution-chain data import for [[Add Evolution functionality]]. Sourced from PokeAPI's
-- /evolution-chain endpoint (541 chains fetched, species matched to our ~985-row `pokedex` import via
-- sprite_code = PokeAPI's own species slug -- same matching key every prior PokeAPI import in this
-- project has used). 328 chains had 2+ matched species and got an evolution_chains grouping; the rest
-- had 0-1 matched species (nothing to group) and are skipped entirely, per this project's established
-- "don't guess" precedent. 479 edges imported after deduping PokeAPI's occasional duplicate
-- evolution_details entries (same edge listed once per version_group, e.g. red-blue vs yellow, that
-- classify identically here).
--
-- Each edge's evolution_details was classified against Design's four trigger types: 'level' only when
-- min_level was the ONLY condition present (an edge with extra PokeAPI conditions -- held item, known
-- move, location, time_of_day, gender, etc. -- alongside min_level does NOT auto-import as 'level',
-- since that would silently make the evolution easier than intended); 'loyalty' only when min_happiness
-- was the only condition (remapped to this app's Loyalty-5 max tier, no in-app Happiness stat exists);
-- 'item' only when the trigger item is one of the 10 existing Evolution Stone catalog items with no
-- other condition attached; everything else (trade evolutions, non-stone items, day/night-gated
-- branches like Espeon/Umbreon, location-gated branches like Leafeon/Glaceon's non-stone path) becomes
-- 'other' -- GM-override only, per Design's resolution that trade-only and other exotic triggers need
-- no special-casing since the override already covers them. Spot-checked against real evolution
-- mechanics (Pichu->Pikachu loyalty, Pikachu->Raichu Thunder Stone, full Eevee branch) before applying.
-- Generator script (fetch-evolutions.mjs) was a throwaway, not committed, same precedent as the
-- original learnset import.

insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (352, 353, 354);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (380, 381, 382);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (408, 410, 1088);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (452, 453, 454);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (976, 977, 978);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (767, 768, 769);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (770, 771);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (772, 773);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (904, 905);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (436, 437, 438);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (703, 704);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (906, 907);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (908, 909);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1313, 1314, 1315);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (523, 524);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (593, 594, 774);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (600, 601, 602);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1149, 1150, 1151, 1158);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (979, 980);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (981, 982);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (705, 706);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (775, 776, 1079);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1089, 1090);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (865, 866, 897);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (507, 508);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (643, 644, 645, 646);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1209, 1210, 1211);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (867, 868, 869);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1152, 1153, 1154);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1091, 1092);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (612, 613, 614);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (517, 518);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1093, 1094, 1103);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (476, 477, 478);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (777, 893);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (778, 779);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (666, 667);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (910, 911);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1095, 1096);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (535, 536, 537);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (629, 630);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1212, 1213);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1097, 1098);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (482, 483);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1155, 1156);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (707, 708);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (870, 871, 872, 873);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (780, 827);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (912, 913);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (546, 547, 548);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (590, 591, 592);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1157, 1174);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (634, 635, 636);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1099, 1100);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1101, 1102);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (553, 555);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (983, 992, 1031);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (574, 575);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (731, 733, 741);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (500, 501, 502);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (680, 681);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (440, 441, 442, 443, 444, 445, 446, 447, 448);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (784, 795);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (939, 940);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (941, 942);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (785, 826);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1253, 1254, 1255);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (355, 356, 357);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (383, 384, 385);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (411, 412, 413);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (786, 787);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (788, 789);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (985, 986);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (987, 988);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (660, 661);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1316, 1317, 1320);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1216, 1217);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (479, 480, 481);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (631, 632, 633);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (678, 679);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (686, 687, 688);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (790, 820);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1159, 1160);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (989, 1012);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (670, 671, 934);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1283, 1286);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (541, 542);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1219, 1225);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (791, 863);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (990, 991);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (551, 552);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1318, 1319);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1104, 1309);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (470, 471, 495);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (728, 793, 794);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (521, 522);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (559, 560, 561);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1055, 1105);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1106, 1107);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1108, 1125);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (468, 469);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (709, 710);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (796, 860);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (944, 945, 946);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (358, 359, 360);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (387, 388, 389);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (414, 415, 416);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1284, 1285);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (799, 800, 1307);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (994, 995, 996, 997, 998);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (637, 638, 639);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1161, 1162, 1163);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (801, 802);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1110, 1111);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (608, 609, 610, 611);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (999, 1000);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1164, 1165);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (803, 804, 805);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1001, 1002, 1003);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (806, 807, 808);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (874, 875);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (947, 957);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (809, 810);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (626, 627, 628);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (876, 877);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (701, 702);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1166, 1169, 1170);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (914, 915);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (675, 676);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1112, 1113);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (513, 514);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1222, 1223);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (711, 712, 713);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1167, 1168);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (474, 475);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (649, 650);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1114, 1115);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (549, 550);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (948, 949);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (950, 951);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1116, 1117);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1038, 1039);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1040, 1041, 1045);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1224, 1226);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (583, 584, 585);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (556, 557, 558);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1118, 1119, 1120);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1256, 1257, 1258);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1062, 1063, 1064);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (361, 362, 363);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (390, 391, 392);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (417, 418, 419);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (815, 816, 817);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (818, 819);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1006, 1007);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (737, 738, 739);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (953, 954);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (955, 956);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1008, 1009);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1010, 1011);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (656, 657);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1171, 1172);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1123, 1124);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1042, 1043);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (821, 822);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (823, 824);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (917, 918);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (692, 693);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1262, 1263, 1264);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (492, 493);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (715, 716);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (919, 920);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (921, 922);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (662, 663);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (543, 544);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1127, 1128);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (364, 365, 366);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (393, 394, 395);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (420, 421, 422);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (830, 831);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (832, 833, 834);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1288, 1289);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1175, 1176);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (515, 516);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1129, 1130);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (682, 683);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (835, 836, 837);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (742, 743);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (615, 616, 617);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1232, 1233);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (717, 718);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (878, 879, 880);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (640, 641, 642);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (461, 462, 463);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (464, 465, 466);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1177, 1178);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1179, 1180);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (719, 720, 721);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (504, 505);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1013, 1014);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1290, 1291);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (727, 1046, 1047);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (668, 669);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (958, 959);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (923, 924);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1292, 1293);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (838, 839);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (605, 606, 607);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1235, 1236, 1237);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1131, 1132);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (562, 563, 564);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (596, 597);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1015, 1016);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1182, 1183);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (664, 665);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1017, 1018);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1184, 1185);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1068, 1069, 1070);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (744, 745, 746);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1238, 1239);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (538, 539, 540);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1265, 1266, 1267);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (567, 568);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1019, 1020);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (883, 884);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (684, 685);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1294, 1295, 1312);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (841, 842);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1296, 1297);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1298, 1299, 1300);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1022, 1023);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (367, 368, 369);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (396, 397, 398);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (424, 425, 426);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (843, 844);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (497, 498, 499);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (458, 459, 460);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (511, 512);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1321, 1322, 1323);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1187, 1188);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (885, 886);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1072, 1073);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1324, 1325);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1326, 1327);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1301, 1302);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (961, 962);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (925, 926);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1134, 1135);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (747, 748);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (963, 964);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (621, 622);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1272, 1273, 1274);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1048, 1049);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (580, 581);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (899, 900);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (370, 371, 372);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (399, 400, 401);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (427, 428, 429);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (846, 847, 848);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (849, 850);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (455, 456, 457);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (888, 889);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1025, 1026);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (927, 928);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (723, 724);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1136, 1137);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1189, 1190);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1191, 1192);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (603, 604);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (851, 852);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1193, 1194, 1195);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1027, 1028);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1050, 1051);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1242, 1243, 1244, 1245);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (929, 930);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (374, 375, 376);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (402, 403, 404);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (430, 431, 432);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (856, 857);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (532, 533, 534);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (449, 450, 451);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1305, 1306);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1197, 1198);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (858, 859);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1140, 1141);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (752, 753);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (618, 619, 620);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (694, 695, 696, 697, 698);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (725, 726);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (647, 648);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (519, 520);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (891, 892);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1053, 1054);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1247, 1248, 1249);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (689, 690, 691);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1330, 1331);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (576, 577);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1080, 1081);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1082, 1087);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1275, 1276, 1277);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (377, 378, 379);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (405, 406, 407);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (433, 434, 435);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1032, 1033);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1034, 1035);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (759, 760, 761);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1333, 1334);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1199, 1200, 1201);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (970, 971, 972);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (525, 526, 527);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (762, 763);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (764, 765);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1310, 1311);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (932, 933);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1202, 1203);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (729, 730);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1204, 1205);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1036, 1037);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1251, 1252);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1335, 1336, 1337);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1144, 1145);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1083, 1084);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (974, 975);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1057, 1058);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (565, 566);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1280, 1281, 1282);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1059, 1086);
insert into evolution_chains default values;
update pokedex set evolution_chain_id = currval(pg_get_serial_sequence('evolution_chains','id')) where id in (1206, 1207);

insert into evolution_triggers (from_pokedex_id, to_pokedex_id, trigger_type, level_requirement, item_id) values
  (352, 353, 'level', 16, null),
  (353, 354, 'level', 32, null),
  (380, 381, 'level', 16, null),
  (381, 382, 'level', 36, null),
  (408, 1088, 'level', 16, null),
  (1088, 410, 'level', 36, null),
  (452, 453, 'level', 7, null),
  (453, 454, 'level', 10, null),
  (976, 977, 'level', 7, null),
  (977, 978, 'level', 10, null),
  (767, 768, 'level', 18, null),
  (768, 769, 'level', 36, null),
  (770, 771, 'level', 20, null),
  (770, 771, 'other', null, null),
  (772, 773, 'level', 20, null),
  (904, 905, 'level', 22, null),
  (436, 437, 'loyalty', null, null),
  (437, 438, 'item', null, 227),
  (703, 704, 'level', 22, null),
  (703, 704, 'item', null, 222),
  (906, 907, 'item', null, 224),
  (908, 909, 'item', null, 224),
  (1315, 1313, 'loyalty', null, null),
  (1313, 1314, 'item', null, 224),
  (523, 524, 'item', null, 221),
  (523, 524, 'item', null, 222),
  (593, 594, 'loyalty', null, null),
  (594, 774, 'item', null, 224),
  (600, 601, 'level', 22, null),
  (601, 602, 'loyalty', null, null),
  (1149, 1150, 'level', 21, null),
  (1150, 1151, 'item', null, 223),
  (1150, 1158, 'item', null, 226),
  (979, 980, 'level', 24, null),
  (981, 982, 'level', 31, null),
  (705, 706, 'level', 26, null),
  (775, 776, 'level', 28, null),
  (775, 776, 'loyalty', null, null),
  (775, 1079, 'level', 28, null),
  (1089, 1090, 'level', 33, null),
  (865, 866, 'level', 28, null),
  (866, 897, 'other', null, null),
  (507, 508, 'item', null, 221),
  (643, 644, 'level', 25, null),
  (644, 645, 'item', null, 228),
  (644, 646, 'other', null, null),
  (1209, 1210, 'level', 16, null),
  (1210, 1211, 'other', null, null),
  (867, 868, 'level', 28, null),
  (868, 869, 'other', null, null),
  (1152, 1153, 'level', 21, null),
  (1153, 1154, 'item', null, 223),
  (1091, 1092, 'level', 30, null),
  (612, 613, 'level', 25, null),
  (613, 614, 'other', null, null),
  (517, 518, 'level', 40, null),
  (1093, 1094, 'level', 37, null),
  (1093, 1094, 'other', null, null),
  (1093, 1103, 'other', null, null),
  (476, 477, 'level', 30, null),
  (477, 478, 'other', null, null),
  (477, 478, 'item', null, 227),
  (777, 893, 'other', null, null),
  (778, 779, 'level', 31, null),
  (666, 667, 'level', 34, null),
  (910, 911, 'level', 38, null),
  (1095, 1096, 'item', null, 228),
  (535, 536, 'level', 25, null),
  (536, 537, 'other', null, null),
  (629, 630, 'other', null, null),
  (1212, 1213, 'level', 26, null),
  (1097, 1098, 'level', 28, null),
  (482, 483, 'level', 30, null),
  (482, 483, 'item', null, 223),
  (1155, 1156, 'item', null, 223),
  (707, 708, 'level', 28, null),
  (707, 708, 'other', null, null),
  (872, 870, 'other', null, null),
  (872, 871, 'other', null, null),
  (872, 873, 'other', null, null),
  (780, 827, 'other', null, null),
  (912, 913, 'level', 35, null),
  (546, 547, 'level', 42, null),
  (547, 548, 'other', null, null),
  (590, 591, 'other', null, null),
  (591, 592, 'loyalty', null, null),
  (1157, 1174, 'other', null, null),
  (634, 635, 'level', 32, null),
  (635, 636, 'other', null, null),
  (1099, 1100, 'level', 33, null),
  (1101, 1102, 'item', null, 228),
  (983, 992, 'other', null, null),
  (983, 1031, 'other', null, null),
  (574, 575, 'level', 30, null),
  (733, 731, 'level', 30, null),
  (731, 741, 'other', null, null),
  (500, 501, 'level', 30, null),
  (501, 502, 'other', null, null),
  (680, 681, 'level', 20, null),
  (440, 441, 'item', null, 228),
  (440, 442, 'item', null, 227),
  (440, 443, 'item', null, 221),
  (440, 444, 'other', null, null),
  (440, 445, 'other', null, null),
  (440, 446, 'other', null, null),
  (440, 446, 'item', null, 223),
  (440, 447, 'other', null, null),
  (440, 447, 'item', null, 222),
  (440, 448, 'other', null, null),
  (784, 795, 'other', null, null),
  (939, 940, 'level', 40, null),
  (941, 942, 'level', 40, null),
  (826, 785, 'loyalty', null, null),
  (1253, 1254, 'level', 30, null),
  (1254, 1255, 'level', 55, null),
  (355, 356, 'level', 16, null),
  (356, 357, 'level', 32, null),
  (383, 384, 'level', 14, null),
  (383, 384, 'level', 17, null),
  (384, 385, 'level', 36, null),
  (411, 412, 'level', 18, null),
  (412, 413, 'level', 30, null),
  (786, 787, 'level', 15, null),
  (788, 789, 'level', 20, null),
  (985, 986, 'level', 18, null),
  (987, 988, 'level', 22, null),
  (660, 661, 'level', 27, null),
  (1316, 1317, 'loyalty', null, null),
  (1317, 1320, 'item', null, 225),
  (1216, 1217, 'level', 25, null),
  (479, 480, 'level', 15, null),
  (480, 481, 'level', 30, null),
  (631, 632, 'loyalty', null, null),
  (632, 633, 'level', 18, null),
  (678, 679, 'other', null, null),
  (686, 687, 'level', 18, null),
  (687, 688, 'level', 27, null),
  (790, 820, 'other', null, null),
  (1159, 1160, 'item', null, 226),
  (989, 1012, 'other', null, null),
  (670, 671, 'level', 20, null),
  (670, 934, 'level', 20, null),
  (1283, 1286, 'item', null, 220),
  (541, 542, 'item', null, 220),
  (1225, 1219, 'level', 15, null),
  (791, 863, 'other', null, null),
  (990, 991, 'level', 31, null),
  (551, 552, 'other', null, null),
  (1318, 1319, 'level', 23, null),
  (1104, 1309, 'other', null, null),
  (470, 471, 'other', null, null),
  (470, 495, 'other', null, null),
  (793, 794, 'level', 30, null),
  (794, 728, 'other', null, null),
  (521, 522, 'level', 38, null),
  (559, 560, 'level', 33, null),
  (560, 561, 'other', null, null),
  (1105, 1055, 'level', 38, null),
  (1106, 1107, 'level', 25, null),
  (1125, 1108, 'other', null, null),
  (468, 469, 'level', 24, null),
  (709, 710, 'level', 25, null),
  (796, 860, 'other', null, null),
  (944, 945, 'level', 30, null),
  (945, 946, 'level', 55, null),
  (358, 359, 'level', 16, null),
  (359, 360, 'level', 36, null),
  (387, 388, 'level', 16, null),
  (388, 389, 'level', 36, null),
  (414, 415, 'level', 16, null),
  (415, 416, 'level', 36, null),
  (1284, 1285, 'level', 18, null),
  (799, 800, 'level', 20, null),
  (800, 1307, 'other', null, null),
  (994, 995, 'level', 7, null),
  (995, 996, 'level', 10, null),
  (994, 997, 'level', 7, null),
  (997, 998, 'level', 10, null),
  (637, 638, 'level', 14, null),
  (638, 639, 'item', null, 228),
  (1161, 1162, 'level', 14, null),
  (1162, 1163, 'item', null, 223),
  (801, 802, 'level', 22, null),
  (1110, 1111, 'level', 25, null),
  (608, 609, 'level', 20, null),
  (609, 610, 'level', 30, null),
  (609, 611, 'other', null, null),
  (999, 1000, 'level', 22, null),
  (1164, 1165, 'level', 23, null),
  (803, 804, 'level', 18, null),
  (804, 805, 'level', 36, null),
  (1001, 1002, 'level', 20, null),
  (1001, 1003, 'other', null, null),
  (806, 807, 'level', 20, null),
  (807, 808, 'level', 40, null),
  (874, 875, 'level', 24, null),
  (947, 957, 'other', null, null),
  (947, 957, 'item', null, 227),
  (809, 810, 'item', null, 224),
  (626, 627, 'level', 32, null),
  (627, 628, 'level', 42, null),
  (876, 877, 'level', 37, null),
  (701, 702, 'level', 26, null),
  (1169, 1166, 'other', null, null),
  (1166, 1170, 'item', null, 225),
  (914, 915, 'level', 26, null),
  (675, 676, 'level', 30, null),
  (1112, 1113, 'level', 40, null),
  (513, 514, 'level', 33, null),
  (1222, 1223, 'level', 32, null),
  (711, 712, 'level', 35, null),
  (712, 713, 'level', 45, null),
  (1167, 1168, 'level', 32, null),
  (474, 475, 'level', 35, null),
  (649, 650, 'level', 30, null),
  (1114, 1115, 'level', 30, null),
  (549, 550, 'level', 36, null),
  (948, 949, 'level', 40, null),
  (950, 951, 'level', 40, null),
  (1116, 1117, 'other', null, null),
  (1038, 1039, 'level', 37, null),
  (1040, 1041, 'level', 37, null),
  (1041, 1045, 'other', null, null),
  (1226, 1224, 'other', null, null),
  (583, 584, 'level', 42, null),
  (583, 585, 'other', null, null),
  (556, 557, 'level', 32, null),
  (557, 558, 'level', 44, null),
  (1118, 1119, 'other', null, null),
  (1118, 1120, 'other', null, null),
  (1256, 1257, 'level', 30, null),
  (1257, 1258, 'level', 50, null),
  (1062, 1063, 'level', 20, null),
  (1063, 1064, 'level', 45, null),
  (361, 362, 'level', 18, null),
  (362, 363, 'level', 32, null),
  (390, 391, 'level', 14, null),
  (391, 392, 'level', 36, null),
  (417, 418, 'level', 16, null),
  (418, 419, 'level', 36, null),
  (815, 816, 'level', 14, null),
  (816, 817, 'level', 34, null),
  (818, 819, 'level', 15, null),
  (1006, 1007, 'level', 10, null),
  (737, 738, 'level', 15, null),
  (738, 739, 'level', 30, null),
  (953, 954, 'level', 30, null),
  (955, 956, 'level', 30, null),
  (1008, 1009, 'other', null, null),
  (1010, 1011, 'other', null, null),
  (656, 657, 'level', 26, null),
  (1171, 1172, 'level', 25, null),
  (1123, 1124, 'level', 30, null),
  (1042, 1043, 'level', 28, null),
  (821, 822, 'loyalty', null, null),
  (823, 824, 'level', 38, null),
  (917, 918, 'level', 34, null),
  (692, 693, 'level', 33, null),
  (1262, 1263, 'level', 24, null),
  (1263, 1264, 'level', 48, null),
  (492, 493, 'other', null, null),
  (715, 716, 'level', 34, null),
  (919, 920, 'level', 40, null),
  (921, 922, 'level', 37, null),
  (662, 663, 'level', 31, null),
  (543, 544, 'level', 40, null),
  (364, 365, 'level', 17, null),
  (365, 366, 'level', 36, null),
  (393, 394, 'level', 17, null),
  (394, 395, 'level', 36, null),
  (420, 421, 'level', 17, null),
  (421, 422, 'level', 36, null),
  (830, 831, 'level', 20, null),
  (832, 833, 'level', 16, null),
  (833, 834, 'level', 32, null),
  (1288, 1289, 'level', 20, null),
  (1175, 1176, 'item', null, 223),
  (515, 516, 'item', null, 221),
  (1129, 1130, 'item', null, 228),
  (682, 683, 'item', null, 224),
  (835, 836, 'level', 21, null),
  (836, 837, 'level', 32, null),
  (742, 743, 'level', 27, null),
  (615, 616, 'level', 25, null),
  (616, 617, 'other', null, null),
  (1232, 1233, 'loyalty', null, null),
  (717, 718, 'level', 31, null),
  (878, 879, 'level', 25, null),
  (879, 880, 'other', null, null),
  (640, 641, 'level', 25, null),
  (641, 642, 'level', 36, null),
  (461, 462, 'level', 20, null),
  (462, 463, 'loyalty', null, null),
  (464, 465, 'level', 22, null),
  (465, 466, 'level', 30, null),
  (1177, 1178, 'item', null, 226),
  (1179, 1180, 'item', null, 226),
  (719, 720, 'level', 29, null),
  (720, 721, 'level', 40, null),
  (504, 505, 'level', 35, null),
  (504, 505, 'item', null, 222),
  (1013, 1014, 'level', 34, null),
  (1290, 1291, 'level', 39, null),
  (1046, 1047, 'level', 34, null),
  (1046, 727, 'other', null, null),
  (668, 669, 'level', 37, null),
  (958, 959, 'level', 37, null),
  (923, 924, 'level', 36, null),
  (1292, 1293, 'level', 30, null),
  (838, 839, 'item', null, 225),
  (605, 606, 'level', 32, null),
  (606, 607, 'level', 41, null),
  (1235, 1236, 'level', 32, null),
  (1236, 1237, 'level', 41, null),
  (1131, 1132, 'level', 35, null),
  (562, 563, 'level', 35, null),
  (563, 564, 'level', 47, null),
  (596, 597, 'level', 34, null),
  (1015, 1016, 'other', null, null),
  (1182, 1183, 'level', 39, null),
  (664, 665, 'level', 40, null),
  (1017, 1018, 'level', 36, null),
  (1184, 1185, 'level', 40, null),
  (1068, 1069, 'level', 38, null),
  (1069, 1070, 'level', 49, null),
  (744, 745, 'level', 39, null),
  (745, 746, 'item', null, 227),
  (1238, 1239, 'level', 42, null),
  (538, 539, 'level', 41, null),
  (539, 540, 'item', null, 220),
  (1265, 1266, 'level', 38, null),
  (1266, 1267, 'level', 48, null),
  (567, 568, 'level', 37, null),
  (1019, 1020, 'other', null, null),
  (883, 884, 'level', 50, null),
  (684, 685, 'level', 43, null),
  (1294, 1295, 'level', 52, null),
  (1295, 1312, 'other', null, null),
  (841, 842, 'level', 54, null),
  (1296, 1297, 'level', 54, null),
  (1298, 1299, 'level', 50, null),
  (1299, 1300, 'level', 64, null),
  (1022, 1023, 'level', 59, null),
  (367, 368, 'level', 16, null),
  (368, 369, 'level', 36, null),
  (396, 397, 'level', 16, null),
  (397, 398, 'level', 36, null),
  (424, 425, 'level', 16, null),
  (425, 426, 'level', 36, null),
  (843, 844, 'level', 20, null),
  (497, 498, 'level', 17, null),
  (498, 499, 'level', 35, null),
  (458, 459, 'level', 9, null),
  (459, 460, 'level', 12, null),
  (511, 512, 'level', 35, null),
  (1321, 1322, 'level', 19, null),
  (1322, 1323, 'item', null, 225),
  (1187, 1188, 'level', 32, null),
  (885, 886, 'other', null, null),
  (1072, 1073, 'level', 35, null),
  (1324, 1325, 'other', null, null),
  (1326, 1327, 'other', null, null),
  (1301, 1302, 'other', null, null),
  (961, 962, 'level', 39, null),
  (925, 926, 'level', 48, null),
  (1134, 1135, 'level', 37, null),
  (747, 748, 'item', null, 226),
  (963, 964, 'other', null, null),
  (621, 622, 'other', null, null),
  (1272, 1273, 'level', 40, null),
  (1273, 1274, 'other', null, null),
  (1048, 1049, 'other', null, null),
  (580, 581, 'level', 37, null),
  (899, 900, 'level', 48, null),
  (370, 371, 'level', 17, null),
  (371, 372, 'level', 34, null),
  (371, 372, 'level', 36, null),
  (399, 400, 'level', 17, null),
  (400, 401, 'level', 34, null),
  (427, 428, 'level', 17, null),
  (428, 429, 'level', 34, null),
  (846, 847, 'level', 14, null),
  (847, 848, 'level', 28, null),
  (849, 850, 'other', null, null),
  (455, 456, 'level', 20, null),
  (456, 457, 'other', null, null),
  (456, 457, 'item', null, 227),
  (888, 889, 'other', null, null),
  (888, 889, 'item', null, 222),
  (1025, 1026, 'level', 25, null),
  (927, 928, 'level', 38, null),
  (723, 724, 'level', 30, null),
  (1136, 1137, 'level', 22, null),
  (1189, 1190, 'other', null, null),
  (1191, 1192, 'level', 24, null),
  (603, 604, 'other', null, null),
  (851, 852, 'level', 27, null),
  (1193, 1194, 'level', 18, null),
  (1194, 1195, 'other', null, null),
  (1027, 1028, 'level', 30, null),
  (1050, 1051, 'level', 42, null),
  (1242, 1243, 'level', 43, null),
  (1243, 1244, 'level', 53, null),
  (1243, 1245, 'level', 53, null),
  (929, 930, 'other', null, null),
  (374, 375, 'level', 16, null),
  (375, 376, 'level', 35, null),
  (402, 403, 'level', 16, null),
  (403, 404, 'level', 35, null),
  (430, 431, 'level', 16, null),
  (431, 432, 'level', 35, null),
  (856, 857, 'level', 24, null),
  (532, 533, 'level', 18, null),
  (533, 534, 'level', 38, null),
  (449, 450, 'level', 10, null),
  (450, 451, 'level', 30, null),
  (1305, 1306, 'level', 18, null),
  (1197, 1198, 'level', 20, null),
  (858, 859, 'level', 24, null),
  (1140, 1141, 'level', 22, null),
  (752, 753, 'level', 25, null),
  (618, 619, 'level', 18, null),
  (619, 620, 'level', 34, null),
  (694, 695, 'other', null, null),
  (694, 696, 'other', null, null),
  (694, 697, 'other', null, null),
  (697, 698, 'other', null, null),
  (725, 726, 'level', 36, null),
  (647, 648, 'level', 26, null),
  (519, 520, 'level', 28, null),
  (891, 892, 'other', null, null),
  (1053, 1054, 'other', null, null),
  (1247, 1248, 'level', 32, null),
  (1248, 1249, 'level', 42, null),
  (689, 690, 'level', 32, null),
  (690, 691, 'level', 42, null),
  (1330, 1331, 'other', null, null),
  (576, 577, 'other', null, null),
  (1080, 1081, 'level', 34, null),
  (1082, 1087, 'other', null, null),
  (1275, 1276, 'level', 50, null),
  (1276, 1277, 'level', 60, null),
  (377, 378, 'level', 16, null),
  (378, 379, 'level', 36, null),
  (405, 406, 'level', 16, null),
  (406, 407, 'level', 36, null),
  (433, 434, 'level', 16, null),
  (434, 435, 'level', 36, null),
  (1032, 1033, 'level', 15, null),
  (1034, 1035, 'level', 24, null),
  (759, 760, 'level', 18, null),
  (760, 761, 'other', null, null),
  (1333, 1334, 'level', 26, null),
  (1199, 1200, 'level', 25, null),
  (1200, 1201, 'level', 35, null),
  (970, 971, 'level', 24, null),
  (971, 972, 'level', 38, null),
  (525, 526, 'other', null, null),
  (525, 527, 'other', null, null),
  (762, 763, 'item', null, 227),
  (764, 765, 'level', 25, null),
  (1310, 1311, 'level', 30, null),
  (932, 933, 'level', 28, null),
  (1202, 1203, 'other', null, null),
  (729, 730, 'level', 30, null),
  (1204, 1205, 'item', null, 221),
  (1036, 1037, 'other', null, null),
  (1251, 1252, 'level', 35, null),
  (1335, 1336, 'level', 24, null),
  (1336, 1337, 'level', 38, null),
  (1144, 1145, 'level', 26, null),
  (1083, 1084, 'level', 40, null),
  (974, 975, 'level', 35, null),
  (1057, 1058, 'other', null, null),
  (565, 566, 'item', null, 222),
  (1280, 1281, 'level', 35, null),
  (1281, 1282, 'level', 54, null),
  (1059, 1086, 'other', null, null),
  (1206, 1207, 'other', null, null);