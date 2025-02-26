# Migration

The following table shows the migration path from the source database to the target database.

Target (postgres 2022) | Origin (mssql 2022) | Type | Title | Description | Lookup |
| --- | --- | --- | --- | --- | --- |
| cluster.intkey | bwineu.dbo.b3_tnr.intkey | string | intkey | Column intkey from nfi2022 |  |
| cluster.cluster_name | bwi.dat.b0_tab.Tnr | number | Cluster ID | The unique identifier for a cluster |  |
| cluster.state_responsible | bwineu.dbo.b3_tnr.dathoheit | string,null | Strata | The unique identifier for a cluster | lookup.lookup_state.code |
| cluster.topo_map_sheet | bwineu.dbo.b3_tnr.TopKar | number | Topographic Map Sheet | The topographic map sheet |  |
| cluster.grid_density | bwi.dat.b0_tab.Netz | string | Grid Density | The grid density of the cluster | lookup.lookup_grid_density.code |
| cluster.cluster_status | bwi.dat.b0_tab.Ktg4 | string | Cluster Status | The status of the cluster | lookup.lookup_cluster_status.code |
| cluster.cluster_situation | bwineu.dbo.b3f_tnr_vorkl.TrStatus | string | Cluster Situation | The situation of the cluster | lookup.lookup_cluster_situation.code |
| plot_landmarks.landmark_azimuth | bwineu.dbo.b3v_ecke_feld.Mark_Azi | integer | Azimut | Markanter Geländepunkt, hier Azimut [gon] |  |
| plot_landmarks.landmark_distance | bwineu.dbo.b3v_ecke_feld.Mark_Hori | integer | Horizontalentfernung | Markanter Geländepunkt, hier Horizontalentfernung [cm] |  |
| plot_landmarks.landmark_note | bwineu.dbo.b3v_ecke_feld.Mark_Beschreibung | string,null | Geländepunkt | Kurz-Beschreibung eines markanten Geländepunktes |  |
| plot_coordinates.center_location | bwi.koord.b0_ecke_soll.Soll_X_WGS84 | string | Center Location |  |  |
| plot_coordinates.cartesian_x | bwi.koord.b0_ecke_soll.Soll_Hoch | number | Hoch | undefined |  |
| plot_coordinates.cartesian_y | bwi.koord.b0_ecke_soll.Soll_Rechts | number | Rechts | undefined |  |
| plot.intkey | bwineu.dbo.b3_ecke.intkey | string | intkey | Column intkey from nfi2022 |  |
| tree.intkey | bwineu.dbo.b3v_wzp.intkey | string | intkey | Column intkey from nfi2022 |  |
| tree.tree_number | bwi.dat.b4_wzp.Bnr | integer | Baumnummer | Eindeutige Baumnummer |  |
| tree.tree_marked | bwi.dat.b4_wzp.Perm | boolean,null | Markiert | Baum permanent markiert |  |
| tree.tree_status | bwi.dat.b4_wzp.Pk | string,null | Probebaumkennziffer | Probebaumkennziffer | lookup.lookup_tree_status.code |
| tree.azimuth | bwi.dat.b4_wzp.Azi | integer,null | Azimut | Azimut [gon] des Baumes |  |
| tree.distance | bwi.dat.b4_wzp.Hori | integer,null | Horizontalentfernung | Horizontalentfernung [cm] des Baumes |  |
| tree.tree_species | bwi.dat.b4_wzp.Ba | string,null | Baumart | Baumart | lookup.lookup_tree_species.code |
| tree.dbh | bwi.dat.b4_wzp.M_Bhd | integer,null | Brusthöhendurchmesser | gemessener BHD [mm] |  |
| tree.dbh_height | bwi.dat.b4_wzp.M_h | string,null | Messhöhe des BHD | Messhöhe des BHD [cm] (Standard 130 cm) |  |
| tree.tree_height | bwi.dat.b4_wzp.M_Hoe | integer,null | Baumhöhe | gemessene Baumhöhe [dm] |  |
| tree.stem_height | bwi.dat.b4_wzp.M_StHoe | integer,null | Baumhöhe | gemessene Stammhöhe [dm] |  |
| tree.tree_height_azimuth | bwi.dat.b4_wzp.MPos_Azi | integer,null | Azimut des Höhenmessbaums | Azimut [Gon] der Messposition zum Höhenmessbaum |  |
| tree.tree_height_distance | bwi.dat.b4_wzp.MPos_Hori | integer,null | Distanz zum Höhenmessbaum | Horizontalentfernung [cm] der Messposition zum Höhenmessbaum |  |
| tree.tree_age | bwi.dat.b4_wzp.Al_ba | integer,null | Distanz zum Höhenmessbaum | Alter des Baumes [Jahre] |  |
| tree.stem_breakage | bwi.dat.b4_wzp.Kh | string,null | Höhenkennziffer | Höhenkennziffer | lookup.lookup_stem_breakage.code |
| tree.stem_form | bwi.dat.b4_wzp.Kst | string,null | Höhenkennziffer | Höhenkennziffer | lookup.lookup_stem_form.code |
| tree.pruning | bwi.dat.b4_wzp.Ast | string,null | Astung | Astung | lookup.lookup_pruning.code |
| tree.within_stand | bwi.dat.b4_wzp.Bz | boolean,null | Bestandeszugehörigkeit | RAUS: Bestandeszugehörigkeit |  |
| tree.stand_layer | bwi.dat.b4_wzp.Bs | string,null | Bestandesschicht | Bestandesschicht | lookup.lookup_stand_layer.code |
| tree.damage_dead | bwi.dat.b4_wzp.Tot | boolean,null | abgestorben | frisch abgestorben |  |
| tree.damage_peel_new | bwi.dat.b4_wzp.jSchael | boolean,null | Schälschäden | jüngere/frische Schälschäden |  |
| tree.damage_peel_old | bwi.dat.b4_wzp.aeSchael | boolean,null | Schälschäden | ältere Schälschäden |  |
| tree.damage_logging | bwi.dat.b4_wzp.Ruecke | boolean,null | Rücke- und Fällschäden | Rücke- und Fällschäden |  |
| tree.damage_fungus | bwi.dat.b4_wzp.Pilz | boolean,null | Pilz | Pilzkonsolen |  |
| tree.damage_resin | bwi.dat.b4_wzp.Harz | boolean,null | Harzlachten | Harzlachten |  |
| tree.damage_beetle | bwi.dat.b4_wzp.Kaefer | boolean,null | Käferbohrlöcher | Käferbohrlöcher |  |
| tree.damage_other | bwi.dat.b4_wzp.sStamm | boolean,null | sonstige Stammschäden | sonstige Stammschäden |  |
| tree.cave_tree | bwi.dat.b4_wzp.Hoehle | boolean,null | Höhlenbaum | Biotop - Höhlenbaum |  |
| tree.crown_dead_wood | bwi.dat.b4_wzp.Bizarr | boolean,null | Lichtkrone abgestorben | Biotop - mehr als ein Drittel der Lichtkrone abgestorben oder drei starke Totäste |  |
| tree.tree_top_drought | bwi.dat.b4_wzp.Uralt | boolean,null | Zopftrocknis | Zopftrocknis |  |
| tree.bark_pocket | bwi.dat.b4_wzp.Horst | boolean,null | Rinde | mit sich lösender Rinde oder Rindentasche >500 cm². Mindestbereite 10 cm |  |
| tree.biotope_marked | bwi.dat.b4_wzp.MBiotop | boolean,null | MarkBiotop | Biotop - Speziell markierter Biotopbaum |  |
| tree.bark_condition | bwineu.dbo.b3v_wzp.WZ1 | integer,null | Rindenzustand | Rindenzustand für frisch abgestorbene WZP4-Bäume |  |
| deadwood.intkey | bwineu.dbo.b3v_tot.intkey | string | intkey | Column intkey from nfi2022 |  |
| deadwood.tree_species_group | bwi.dat.b4_tot.Tbagr | string,null | Baumartengruppe | Baumartengruppe für Totholz | lookup.lookup_tree_species_group.code |
| deadwood.dead_wood_type | bwi.dat.b4_tot.Tart | string,null | Totholztyp | Totholztyp | lookup.lookup_dead_wood_type.code |
| deadwood.decomposition | bwi.dat.b4_tot.Tzg | string,null | Zersetzungsgrad | Zersetzungsgrad | lookup.lookup_decomposition.code |
| deadwood.length_height | bwi.dat.b4_tot.Tl | integer,null | Länge / Höhe | Länge / Höhe Totholz [dm] |  |
| deadwood.diameter_butt | bwi.dat.b4_tot.Tbd | integer,null | maximale Durchmesser | Durchmesser am dicken Ende [cm] (liegende Bruchstücke); Schnittflächen- (Stöcke), Bhd (mit Wurzel, >=130 cm Länge) |  |
| deadwood.diameter_top | bwi.dat.b4_tot.Tsd | integer,null | minimale Durchmesser | Durchmesser am dünnen Ende [cm] (nur bei liegenden Totholz OHNE Wurzelanlauf) |  |
| deadwood.count | bwi.dat.b4_tot.Anz | integer,null | Anzahl | Anzahl gleichartiger Totholzstücke |  |
| deadwood.bark_pocket | bwi.dat.b4_tot.TRinde | integer,null | Rindentaschen | Rindentaschen > 500 cm² mit einer Mindestbreite von 10 cm (nur für stehendes Totholz) |  |
| position.intkey | bwineu.dbo.b3v_gps.intkey | string | intkey | Column intkey from nfi2022 |  |
| position.position_median | bwineu.dbo.b3v_gps.LAT_MED | string,null | Koordinaten Median | Latitude / Longitude |  |
| position.position_mean | bwineu.dbo.b3v_gps.LAT_MED | string | Koordinaten Mittel | Latitude / Longitude |  |
| position.hdop_mean | bwineu.dbo.b3v_gps.HDOP | number,null | Genauigkeit | Genauigkeit der Positionsmessung |  |
| position.pdop_mean | bwineu.dbo.b3v_gps.PDOP | number,null | Genauigkeit | Genauigkeit der Positionsmessung |  |
| position.satellites_count_mean | bwineu.dbo.b3v_gps.NumSat | number,null | Anzahl der Satelliten | Mittlere Anzahl der Satelliten |  |
| position.measurement_count | bwineu.dbo.b3v_gps.AnzahlMessungen | number,null | Anzahl der Messungen | Anzahl der GPS Messungen |  |
| position.rtcm_age | bwineu.dbo.b3v_gps.RTCMAlter | number,null | Anzahl der Messungen | Anzahl der GPS Messungen |  |
| position.start_measurement | bwineu.dbo.b3v_gps.UTCStartzeit | string,null | Startzeit | Beginn der Messung |  |
| position.stop_measurement | bwineu.dbo.b3v_gps.UTCStopzeit | string,null | Stopzeit | Ende der Messung |  |
| position.device_gnss | bwineu.dbo.b3v_gps.Geraet | string,null | GNSS-Gerät | Technische Bezeichnung des Gerätes |  |
| position.quality | bwineu.dbo.b3v_gps.GNSS_Qualitaet | string,null | Qualität | Qualität der verwendeten GNSS-Einmessung | lookup.lookup_gnss_quality.code |
| edges.intkey | bwineu.dbo.b3v_wrand.intkey | string | intkey | Column intkey from nfi2022 |  |
| edges.edge_status | bwi.dat.b4_wrand.Rk | string,null | Kennziffer des Wald-/Bestandesrandes | Kennziffer des Wald-/Bestandesrandes | lookup.lookup_edge_status.code |
| edges.edge_number | bwi.dat.b4_wrand.Rnr | integer,null | Waldrandnummer | Waldrandnummer |  |
| edges.edge_type | bwi.dat.b4_wrand.Rart | string,null | Art des Wald- /Bestandesrandes | Art des Wald- /Bestandesrandes | lookup.lookup_edge_type.code |
| edges.terrain | bwi.dat.b4_wrand.Rterrain | string,null | Vorgelagertes Terrain | Vorgelagertes Terrain | lookup.lookup_terrain.code |
| edges.azimuth | undefined | integer | Azimut | Azimut in Gon |  |
| edges.distance | undefined | integer | Distanz | Distanz in cm |  |
| subplots_relative_position.azimuth | bwineu.dbo.b3v_ecke_feld.B0_Move | integer | azimuth | Richtung in GON |  |
| subplots_relative_position.distance | bwineu.dbo.b3v_ecke_feld.B0_Hori | integer | distance | Entfernung in Zentimeter |  |
| subplots_relative_position.radius | bwineu.dbo.b3v_ecke_feld.B0_Radius | integer | radius | Radius in Meter |  |
| regeneration.intkey | bwineu.dbo.b3v_b0.intkey | string | intkey | Column intkey from nfi2022 |  |
| regeneration.tree_species | bwi.dat.b4_jung.Ba | string,null | Baumart | Baumart | lookup.lookup_tree_species.code |
| regeneration.browsing | bwi.dat.b4_jung.Verbiss | string,null | Verbiss | einfacher oder mehrfacher Verbiss der Terminalknospe | lookup.lookup_browsing.code |
| regeneration.tree_size_class | bwi.dat.b4_jung.Gr | string,null | Baumgrößenklasse | Baumgrößenklasse | lookup.lookup_tree_size_class.code |
| regeneration.damage_peel | bwi.dat.b4_jung.Schael | string,null | Schälschäden | Schälschäden (frische und/oder ältere) |  |
| regeneration.protection_individual | bwi.dat.b4_jung.Schu | boolean,null | Schälschäden | Schälschäden (frische und/oder ältere) |  |
| regeneration.tree_count | bwi.dat.b4_jung.Anz | integer,null | Anzahl gleichartiger Bäume | Anzahl gleichartiger Bäume |  |
| structure_lt4m.intkey | bwineu.dbo.b3v_le4m_ba.intkey | string | intkey | Column intkey from nfi2022 |  |
| structure_lt4m.tree_species | bwi.dat.b4_bestock_le4m_ba.Ba | string,null | Baumart | Baumart | lookup.lookup_tree_species.code |
| structure_lt4m.coverage | bwi.dat.b4_bestock_le4m_ba.Anteil | integer,null | Anteil der Baumart in Zehntel | Anteil der Baumart in Zehntel (Deckungsgrad entspricht 10 Zehntel = 100 %) |  |
| structure_lt4m.regeneration_type | bwi.dat.b4_bestock_le4m_ba.Vart_ba | integer,null | Verjüngungsart | Verjüngungsart der Baumart | lookup.lookup_trees_less_4meter_origin.code |
| plot.plot_name | bwi.dat.b0_ecke.Enr | number | Plot ID | The unique identifier for a plot |  |
| plot.cluster_name | bwi.dat.b0_ecke.Tnr | number | Cluster ID | The unique identifier for a plot |  |
| plot.sampling_stratum | bwi.dat.b0_ecke.Vbl | number | Cluster ID | The unique identifier for a plot | lookup.lookup_sampling_stratum.code |
| plot.federal_state | bwineu.dbo.b3_ecke.dathoheit | string,null | Federal State | Kürzel des Aufnahmelandes | lookup.lookup_state.code |
| plot.growth_district | bwi.dat.b4_ecke_raum.Wb | integer,null | Wuchsbezirk | Wuchsbezirk | lookup.lookup_growth_district.code |
| plot.forest_status | bwi.dat.b4_ecke_w.Wa | string,null | Waldentscheid | Waldentscheid an der Traktecke | lookup.lookup_forest_status.code |
| plot.accessibility | bwi.dat.b4_ecke_w.Begehbar | integer,null | Begehbarkeit | Waldentscheid an der Traktecke | lookup.lookup_accessibility.code |
| plot.forest_office | bwi.dat.b4_ecke_raum.FA | integer,null | Forstamt | Forstamt | lookup.lookup_forest_office.code |
| plot.elevation_level | bwi.dat.b0_ecke.NatHoe | string,null | elevation_level | Forstamt | lookup.lookup_elevation_level.code |
| plot.property_type | bwi.dat.b4_ecke_w.Eg | string,null | Eigentumsart | Eigentumsart | lookup.lookup_property_type.code |
| plot.property_size_class | bwi.dat.b4_ecke_w.EgGrkl | string,null | Eigentumsgrößenklasse | Eigentumsgrößenklasse | lookup.lookup_property_size_class.code |
| plot.forest_community | bwi.dat.b4_ecke_w.NatWgV | string,null | Waldgesellschaft | potentielle natürliche Waldgesellschaft | lookup.lookup_forest_community.code |
| plot.forest_community_field | bwi.dat.b4_ecke_w.NatWgF | string,null | Waldgesellschaft | potentielle natürliche Waldgesellschaft im Feld zu bestimmen | lookup.lookup_forest_community.code |
| plot.ffh_forest_type | bwi.dat.b4_ecke_w.WLT_V | string,null | Waldlebesraumtyp | Waldlebesraumtyp | lookup.lookup_ffh_forest_type.code |
| plot.ffh_forest_type_field | bwi.dat.b4_wlt_f.WLT | string,null | Waldlebesraumtyp | Waldlebesraumtyp im Feld zu bestimmen | lookup.lookup_ffh_forest_type.code |
| plot.land_use_before | bwi.dat.b3_ecke_raum.LaNu | string,null | Landnutzungsart | Landnutzungsart | lookup.lookup_land_use.code |
| plot.land_use_after | bwi.dat.b4_ecke_raum.LaNu | string,null | Waldlebesraumtyp (TODO CHECKED:  bwineu.dbo.bv_ecke.LaNu ?) | Waldlebesraumtyp im Feld zu bestimmen | lookup.lookup_land_use.code |
| plot.coast | bwi.dat.b4_ecke_raum.Kueste | boolean,null | Küsten-/Strandnähe | bewaldete Küstendüne (unmittelbar in Küsten- bzw. Strandnähe) |  |
| plot.sandy | bwineu.dbo.b3f_ecke_vorkl.Gestein | boolean,null | Sand / Vegetationszeiger | trockener sandiger Boden oder wechseltrockene Standorte oder Vegetationszeiger oder andere gesicherte Bestätigung |  |
| plot.protected_landscape | bwi.dat.b4_ecke_raum.LSG | boolean,null | Landschaftschutzgebiet | neu verschnitten mit Soll-Koordinaten (EPSG: 31463 DHDN GK3; nach EPSG:25832 projiziert) von S. Schnell mit BfN-Layer Stand 2018; übernommen 30.10.2020 (Thünen-Institut) |  |
| plot.histwald | bwi.dat.b4_ecke_raum.HistWald | boolean,null | Historischer Wald | Historischer Wald, seit langem (bisher nur NI) Input für WLT_Algorithmus |  |
| plot.harvest_restriction | bwi.dat.b4_ecke_w.Ne | integer,null | Nutzungseinschränkung | Nutzungseinschränkung (x3_ne) | lookup.lookup_harvest_restriction.code |
| plot.harvest_restriction_nature_reserve | bwi.dat.b4_ecke_w.NeNSchutz | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_protection_forest | bwi.dat.b4_ecke_w.NeSWald | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_recreational_forest | bwi.dat.b4_ecke_w.NeEWald | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_scattered | bwi.dat.b4_ecke_w.NeSplitter | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_fragmented | bwi.dat.b4_ecke_w.NeStreu | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_insufficient_access | bwi.dat.b4_ecke_w.NeUnErschlies | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_wetness | bwi.dat.b4_ecke_w.NeGelEig | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_low_yield | bwi.dat.b4_ecke_w.NeGerErtrag | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_private_conservation | bwi.dat.b4_ecke_w.NeEigenbin | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.harvest_restriction_other_internalcause | bwi.dat.b4_ecke_w.NeSIBUrsach | boolean | Nutzungseinschränkung | Nutzungseinschränkung (_x3_ne) (TODO CHECKED:  bwi.dat.b4_ecke_w.Ne ?) |  |
| plot.marker_status | bwi.dat.b4_ecke_w.Perm | string,null | Markierung | Permanente Trakteckenmarkierung gefunden/gesetzt | lookup.lookup_marker_status.code |
| plot.marker_azimuth | bwineu.dbo.b3v_ecke_feld.Perm_Azi | integer,null | Azimut | Position (Azimut [gon]) der permanenten Trakteckenmarkierung |  |
| plot.marker_distance | bwineu.dbo.b3v_ecke_feld.Perm_Hori | integer,null | Horizontalentfernung | Position (Horizontalentfernung [cm]) der permanenten Trakteckenmarkierung |  |
| plot.marker_profile | bwineu.dbo.b3v_ecke_feld.Perm_Profil | string,null | Profil | Profil der permanenten Trakteckenmarkierung; fakultativ | lookup.lookup_marker_profile.code |
| plot.terrain_form | bwi.dat.b0_ecke.Gform | string,null | Geländeform | Geländeform | lookup.lookup_terrain_form.code |
| plot.terrain_slope | bwi.dat.b0_ecke.Gneig | integer,null | Geländeneigung | Geländeneigung [Grad] |  |
| plot.terrain_exposure | bwi.dat.b0_ecke.Gexp | integer,null | Geländeexposition | Geländeexposition [Gon] |  |
| plot.management_type | bwi.dat.b4_holzbod.Be | string,null | Betriebsart | Betriebsart | lookup.lookup_management_type.code |
| plot.harvesting_method | bwi.dat.b4_holzbod.Ernte | string,null | Ernte | Bedingungen für die Holzernte | lookup.lookup_harvesting_method.code |
| plot.biotope | bwi.dat.b4_ecke_w.Biotop | string,null | GeschütztesBiotop | Besonders geschütztes Waldbiotop | lookup.lookup_biotope.code |
| plot.stand_structure | bwi.dat.b4_bestock.BestockAb | string,null | Aufbau | Aufbau der Bestockung | lookup.lookup_stand_structure.code |
| plot.stand_age | bwi.dat.b4_bestock.BestockAl | integer,null | Alter | Alter der Bestockung [Jahre], zum Stichjahr 2022 |  |
| plot.stand_development_phase | bwi.dat.b4_bestock.Phase | string,null | Phase/Dimensionsklasse | Entwicklungsphase / Wuchsklasse / Dimensionsklasse | lookup.lookup_stand_development_phase.code |
| plot.stand_layer_regeneration | bwineu.dbo.b3v_ecke_feld.B0_Bs | string,null | Schicht | Bestandesschicht aller jungen Bäume der Probekreise r=1 / 2m (Baumgrößen 0-6) | lookup.lookup_stand_layer.code |
| plot.fence_regeneration | bwineu.dbo.b3v_ecke_feld.B0_Zaun | boolean,null | Zaun | Zäunung der Probeflächen r=1 / 2 m (Baumgrößen 0-6) |  |
| plot.trees_greater_4meter_mirrored | bwineu.dbo.b3v_ecke_feld.SchiGT4_Sp | string,null | Spiegelungsart | Art der Spiegelung aller Bäume der Bestockung über 4 m Höhe | lookup.lookup_trees_less_4meter_mirrored.code |
| plot.trees_greater_4meter_basal_area_factor | bwineu.dbo.b3v_ecke_feld.SchiGT4_ZF | string,null | Zählfaktor | Zählfaktor aller Bäume der Bestockung über 4 m Höhe | lookup.lookup_basal_area_factor.code |
| plot.trees_less_4meter_coverage | bwi.dat.b4_bestock_le4m.BeDG | integer,null | Deckungsgrad | Gesamt-Deckungsgrad aller Bäume der Bestockung bis ca. 4 m Höhe |  |
| plot.trees_less_4meter_layer | bwi.dat.b4_bestock_le4m.Schi | string,null | Schicht | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_trees_less_4meter_layer.code |
| plot.biogeographische_region | bwi.dat.b4_ecke_raum.BiogeogrRegion | string,null | biogeographische_region | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_biogeographische_region.code |
| plot.biosphaere | bwi.dat.b4_ecke_raum.Biosphaere | string,null | Biosphaere | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_biosphaere.code |
| plot.ffh | bwi.dat.b4_ecke_raum.FFH | string,null | FFH | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_ffh.code |
| plot.national_park | bwi.dat.b4_ecke_raum.NationalP | string,null | NationalP | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_national_park.code |
| plot.natur_park | bwi.dat.b4_ecke_raum.NaturP | string,null | naturP | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_natur_park.code |
| plot.vogel_schutzgebiet | bwi.dat.b4_ecke_raum.VogelSG | string,null | VogelSG | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_vogel_schutzgebiet.code |
| plot.natur_schutzgebiet | bwi.dat.b4_ecke_raum.NaturSG | string,null | NaturSG | Schicht aller Bäume der Bestockung bis ca. 4 m Höhe | lookup.lookup_natur_schutzgebiet.code |
