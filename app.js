/**
 * NIGHTLIFE GEOGUESSR - GAME CORE ENGINE & DATABASE
 * File: app.js
 * Description: Contains the full 40-venue Blackpool dataset grouped into 5 districts,
 * alongside the geospatial mathematical scoring engine.
 *
 * Note: streetview_settings (heading/pitch) are placeholder defaults and
 * interior_images are placeholder filenames. Tune both per venue.
 */

// ==========================================
// 1. THE COMPLETE 40-VENUE DATABASE PAYLOAD
// ==========================================
const VENUE_DATABASE = [
  {
    "district": "The Queen Street & Dickson Road Village",
    "venues": [
      {"id": "lgbt_01", "name": "Funny Girls", "type": "LGBTQ+ Cabaret Showbar", "address": "5 Dickson Rd, Blackpool FY1 2AX", "coordinates": {"lat": 53.8202, "lng": -3.0531}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_01_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Famous drag cabaret showbar on Dickson Road, a short walk north of North Pier and the Tower.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "lgbt_02", "name": "The Flying Handbag", "type": "LGBTQ+ Bar", "address": "44 Queen St, Blackpool FY1 1DL", "coordinates": {"lat": 53.82, "lng": -3.0519}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_02_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Bar on Queen Street, sharing its building with the Flamingo nightclub.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "lgbt_03", "name": "Peek A Booze", "type": "LGBTQ+ Cabaret Bar", "address": "72-74 Dickson Rd, Blackpool FY1 2BU", "coordinates": {"lat": 53.8219, "lng": -3.0526}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_03_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Cabaret bar further up Dickson Road, in the run of venues north of the Funny Girls end.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "lgbt_04", "name": "Flamingo", "type": "LGBTQ+ Nightclub", "address": "44 Queen St, Blackpool FY1 1DL", "coordinates": {"lat": 53.8201, "lng": -3.0519}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_04_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Big LGBTQ+ nightclub on Queen Street, under the same roof as the Flying Handbag.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "lgbt_05", "name": "Kaos", "type": "LGBTQ+ Nightclub", "address": "38-42 Queen St, Blackpool FY1 1DL", "coordinates": {"lat": 53.8199, "lng": -3.0521}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_05_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Nightclub a few doors along Queen Street from the Flamingo and Flying Handbag building.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "lgbt_06", "name": "Growlr Club @ Man Bar", "type": "LGBTQ+ Pub & Club", "address": "Dickson Rd, Blackpool FY1 2AX", "coordinates": {"lat": 53.8204, "lng": -3.053}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_06_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Pub and club on Dickson Road, right at the Funny Girls end of the street.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "lgbt_07", "name": "Lu-Lu’s Cabaret Lounge", "type": "LGBTQ+ Cabaret Bar", "address": "82 Dickson Rd, Blackpool FY1 2BU", "coordinates": {"lat": 53.8222, "lng": -3.0525}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_07_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Cabaret lounge near the top of Dickson Road, just past Peek A Booze.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "lgbt_08", "name": "Mardi Gras Public Bar", "type": "LGBTQ+ Pub", "address": "41-43 Lord St, Blackpool FY1 2BJ", "coordinates": {"lat": 53.8225, "lng": -3.0518}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_08_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Back-street pub on Lord Street, one block inland from Dickson Road.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "lgbt_09", "name": "Garlands", "type": "LGBTQ+ Party Bar", "address": "69-71 Talbot Rd, Blackpool FY1 3LL", "coordinates": {"lat": 53.8195, "lng": -3.051}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["lgbt_09_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Party bar on Talbot Road, heading inland towards the North Station end of town.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}}
    ]
  },
  {
    "district": "The Cocktail & Prom Lounge Set",
    "venues": [
      {"id": "bar_10", "name": "Saoko Cocktail Club", "type": "Cocktail Bar", "address": "33 Clifton St, Blackpool FY1 1JD", "coordinates": {"lat": 53.8188, "lng": -3.0532}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["bar_10_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Cocktail bar on Clifton Street, the town-centre side street off Talbot Square.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "bar_11", "name": "Dirty Blondes", "type": "Indie/Alternative Bar", "address": "3 Back Church St, Blackpool FY1 1HP", "coordinates": {"lat": 53.8176, "lng": -3.0538}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["bar_11_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Indie and alternative bar tucked down Back Church Street behind the main shopping streets.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "bar_12", "name": "Spyglass Bar", "type": "Theme Cocktail Bar", "address": "Palatine Building, Promenade, Blackpool FY1 1BP", "coordinates": {"lat": 53.8177, "lng": -3.0558}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["bar_12_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Themed cocktail bar in the Palatine Building on the Promenade, close to Central Pier's town end.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "bar_13", "name": "The Retro Lounge Blackpool", "type": "Cocktail & Music Lounge", "address": "3-5 Clifton St, Blackpool FY1 1JD", "coordinates": {"lat": 53.8187, "lng": -3.0539}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["bar_13_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Cocktail and music lounge at the seaward end of Clifton Street, near Talbot Square.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "bar_14", "name": "Beach House Bar & Restaurant", "type": "Beachfront Bar Lounge", "address": "Festival House, Promenade, Blackpool FY1 1AP", "coordinates": {"lat": 53.817, "lng": -3.056}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["bar_14_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Beachfront lounge in Festival House on the Promenade, with glass frontage facing the sea.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "bar_15", "name": "Fubar's Rum Bar", "type": "Rum Bar", "address": "132-134 North Promenade, Blackpool FY1 1RA", "coordinates": {"lat": 53.8215, "lng": -3.0555}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["bar_15_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Rum bar on the North Promenade stretch, looking straight out over the sea.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "bar_16", "name": "Soul Suite", "type": "Motown / Soul Bar", "address": "142-144 Promenade, Blackpool FY1 1RE", "coordinates": {"lat": 53.8143, "lng": -3.0549}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["bar_16_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Motown and soul bar on the central Promenade, in the busy run between the Tower and Central Pier.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}}
    ]
  },
  {
    "district": "The Real Ale & Old Pub Trail",
    "venues": [
      {"id": "pub_17", "name": "The Mitre", "type": "Traditional Pub", "address": "3 West St, Blackpool FY1 1HA", "coordinates": {"lat": 53.8173, "lng": -3.0543}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_17_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Small traditional pub on West Street, one of the narrow lanes behind the Promenade near the Tower.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "pub_18", "name": "Cask & Tap", "type": "Micro Bar / Real Ale", "address": "82 Topping St, Blackpool FY1 3AD", "coordinates": {"lat": 53.8194, "lng": -3.0494}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_18_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Micro bar on Topping Street, a quiet side street inland from the town centre.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "pub_19", "name": "The Ardwick", "type": "Traditional Pub", "address": "34 Foxhall Rd, Blackpool FY1 5AD", "coordinates": {"lat": 53.8115, "lng": -3.0535}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_19_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Traditional pub on Foxhall Road, in the streets south of the Tower near Central Pier.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "pub_20", "name": "Scruffy Murphys", "type": "Irish Pub", "address": "32 Corporation St, Blackpool FY1 1EJ", "coordinates": {"lat": 53.8188, "lng": -3.052}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_20_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Irish pub on Corporation Street, in the heart of the town centre near the Winter Gardens side.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "pub_21", "name": "The Pump & Truncheon", "type": "Traditional Pub / Real Ale", "address": "13 Bonny St, Blackpool FY1 5AR", "coordinates": {"lat": 53.8145, "lng": -3.0539}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_21_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Real ale pub on Bonny Street, the back road behind the Promenade by the old police station.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "pub_22", "name": "Rose & Crown P H", "type": "Traditional Pub", "address": "22 Corporation St, Blackpool FY1 1EJ", "coordinates": {"lat": 53.8186, "lng": -3.0521}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_22_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Traditional pub a few doors down Corporation Street from Scruffy Murphys.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "pub_23", "name": "Castle Hotel", "type": "Traditional Pub", "address": "28-32 Central Dr, Blackpool FY1 5PZ", "coordinates": {"lat": 53.8138, "lng": -3.0515}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_23_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Traditional pub on Central Drive, the long road running inland and parallel to the Promenade.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "pub_24", "name": "Lifeboat Inn", "type": "Traditional Pub", "address": "58 Foxhall Rd, Blackpool FY1 5AD", "coordinates": {"lat": 53.8111, "lng": -3.0533}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["pub_24_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Traditional pub further along Foxhall Road, a near neighbour of Ma Kellys.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}}
    ]
  },
  {
    "district": "The Live Music & Alternative Scene",
    "venues": [
      {"id": "alt_25", "name": "The Waterloo Music Bar", "type": "Live Music Bar / Rock Pub", "address": "166 Waterloo Rd, Blackpool FY4 2AF", "coordinates": {"lat": 53.7995, "lng": -3.0422}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["alt_25_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Live music and rock pub on Waterloo Road in South Shore, well away from the seafront crowds.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "alt_26", "name": "Rhythm & Brew Room", "type": "Brewery Pub / Music Venue", "address": "139 Church St, Blackpool FY1 3NX", "coordinates": {"lat": 53.8179, "lng": -3.0495}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["alt_26_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Brewery pub and music venue up Church Street, past the Winter Gardens heading inland.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "alt_27", "name": "Little Black Pug Bar", "type": "Music Bar", "address": "13 Talbot Rd, Blackpool FY1 1LB", "coordinates": {"lat": 53.8193, "lng": -3.0527}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["alt_27_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Music bar near the seaward end of Talbot Road, close to Talbot Square.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "alt_28", "name": "Cowboy & Co.", "type": "Country Music Bar", "address": "27 Queen St, Blackpool FY1 1NL", "coordinates": {"lat": 53.8196, "lng": -3.0524}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["alt_28_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Country music bar on Queen Street, opposite the stretch of LGBTQ+ venues.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "alt_29", "name": "The Sub", "type": "Alternative Rock Bar", "address": "9 Rigby Rd, Blackpool FY1 5DE", "coordinates": {"lat": 53.8095, "lng": -3.051}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["alt_29_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Hard", "clue_hint": "Alternative rock bar on Rigby Road, inland near the tram depot south of the centre.", "points_thresholds": {"perfect": 5, "good": 25, "acceptable": 90}}},
      {"id": "alt_30", "name": "Ma Kellys Talbot Road", "type": "Entertainment Bar", "address": "67 Talbot Rd, Blackpool FY1 3LL", "coordinates": {"lat": 53.8194, "lng": -3.0511}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["alt_30_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Entertainment bar on Talbot Road, right next door to Garlands.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "alt_31", "name": "Ma Kellys Foxhall Road", "type": "Entertainment Bar", "address": "62 Foxhall Rd, Blackpool FY1 5AD", "coordinates": {"lat": 53.811, "lng": -3.0532}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["alt_31_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Entertainment bar on Foxhall Road, the south-of-centre branch of the Ma Kellys name.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}}
    ]
  },
  {
    "district": "The Seafront Party Strip",
    "venues": [
      {"id": "sea_32", "name": "The Velvet Coaster", "type": "Wetherspoon Pub & Rooftop", "address": "501-507 Promenade, Blackpool FY4 1BA", "coordinates": {"lat": 53.7938, "lng": -3.0558}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_32_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Wetherspoon with a rooftop terrace on the South Promenade, overlooking the Pleasure Beach rides.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "sea_33", "name": "Popworld", "type": "Party Bar / Club", "address": "120-122 Promenade, Blackpool FY1 1RA", "coordinates": {"lat": 53.8148, "lng": -3.0547}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_33_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Party bar on the central Promenade, a few doors from Soul Suite.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "sea_34", "name": "The Layton Rakes", "type": "Wetherspoon Pub", "address": "17-25 Market St, Blackpool FY1 1ET", "coordinates": {"lat": 53.8183, "lng": -3.0525}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_34_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Wetherspoon on Market Street, in the town centre a block back from the Promenade.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "sea_35", "name": "Station Blackpool", "type": "Party Bar", "address": "23 Talbot Rd, Blackpool FY1 1LB", "coordinates": {"lat": 53.8192, "lng": -3.0523}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_35_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Party bar on Talbot Road, a few doors from Little Black Pug.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "sea_36", "name": "Walkabout", "type": "Aussie Sports & Party Bar", "address": "1-9 Queen St, Blackpool FY1 1NL", "coordinates": {"lat": 53.8192, "lng": -3.0531}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_36_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Aussie sports bar on the corner where Queen Street meets the Promenade.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "sea_37", "name": "The Albert & The Lion", "type": "Wetherspoon Seafront Pub", "address": "Bank Hey St, Blackpool FY1 4TQ", "coordinates": {"lat": 53.8159, "lng": -3.0549}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_37_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Wetherspoon on Bank Hey Street, right beside Blackpool Tower.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "sea_38", "name": "Shenanigans", "type": "Karaoke & Irish Bar", "address": "100 Promenade, Blackpool FY1 1HB", "coordinates": {"lat": 53.8166, "lng": -3.0553}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_38_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Easy", "clue_hint": "Karaoke and Irish bar on the Promenade, between the Tower and North Pier.", "points_thresholds": {"perfect": 10, "good": 50, "acceptable": 150}}},
      {"id": "sea_39", "name": "The Dutton Arms", "type": "Generous Local Pub", "address": "441 Promenade, Blackpool FY4 1AR", "coordinates": {"lat": 53.7963, "lng": -3.0556}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_39_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Local pub on the South Promenade, a short walk north of the Pleasure Beach.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}},
      {"id": "sea_40", "name": "The Manchester", "type": "Traditional Seafront Pub", "address": "231-233 Promenade, Blackpool FY1 6AY", "coordinates": {"lat": 53.8066, "lng": -3.0548}, "streetview_settings": {"heading": 0.0, "pitch": 0.0, "zoom": 1, "lock_movement": false}, "media": {"interior_images": ["sea_40_main.jpg"], "panoramic_url": ""}, "gameplay": {"difficulty": "Medium", "clue_hint": "Seafront pub on the Promenade south of Central Pier, at the corner of Lytham Road.", "points_thresholds": {"perfect": 10, "good": 40, "acceptable": 120}}}
    ]
  }
];

// ==========================================
// 2. MATHEMATICAL CORE ENGINE
// ==========================================
/**
 * Calculates the absolute distance between two geographic coordinates using the Haversine formula.
 * @param {Object} coords1 - Format: { lat: number, lng: number }
 * @param {Object} coords2 - Format: { lat: number, lng: number }
 * @returns {number} Distance in meters
 */
function calculateDistanceInMeters(coords1, coords2) {
  const EARTH_RADIUS_METERS = 6371000;

  const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
  const dLng = (coords2.lng - coords1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Translates distance accuracy into a GeoGuessr-style scale score.
 * Max score is 5000 points. Within 15 meters returns max points.
 * @param {number} distanceMeters - Calculated error from target location.
 * @returns {number} Points score between 0 and 5000.
 */
function calculateScore(distanceMeters) {
  const MAX_SCORE = 5000;
  const PERFECT_THRESHOLD_METERS = 15;
  const SCALING_FACTOR = 300; // Tweaks how fast points decay over distance

  if (distanceMeters <= PERFECT_THRESHOLD_METERS) {
    return MAX_SCORE;
  }
  // Exponential decay model calculation
  let points = Math.round(MAX_SCORE * Math.exp(-distanceMeters / SCALING_FACTOR));
  return Math.max(0, points);
}

// ==========================================
// 3. UTILITY FLATTENER FOR ROUND GENERATION
// ==========================================
/**
 * Extracts all 40 venues into a single flat array for easier random selection.
 * @returns {Array} List of all 40 venues.
 */
function getAllVenuesFlatList() {
  let flatList = [];
  VENUE_DATABASE.forEach(districtObj => {
    districtObj.venues.forEach(venue => {
      // Retain reference to parent category district
      venue.district_name = districtObj.district;
      flatList.push(venue);
    });
  });
  return flatList;
}

// Export references: works as a plain <script> (window.NightlifeGeo) and in Node (require)
const NightlifeGeo = {
  VENUE_DATABASE,
  calculateDistanceInMeters,
  calculateScore,
  getAllVenuesFlatList
};
if (typeof module !== "undefined" && module.exports) module.exports = NightlifeGeo;
if (typeof window !== "undefined") window.NightlifeGeo = NightlifeGeo;
