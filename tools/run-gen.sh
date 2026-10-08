#!/bin/sh
# Generates every placeholder image used by the demo.
# The upstream image service answers 402 to concurrent requests, so this runs
# strictly one at a time with a pause between calls. Already generated files
# are skipped, which makes the script safe to re-run.
cd "$(dirname "$0")" || exit 1
IMG=../assets/img

run() {
  slug=$1
  if [ -f "$IMG/$slug.jpg" ]; then
    echo "  skip $slug"
    return
  fi
  python3 genimg.py "$1" "$2" "$3" "$4" "$5"
  sleep 12
}

run "hero-2" "a candlelit fine dining room with velvet banquettes brass pendant lights and linen tables" 1920 1080 202
run "hero-3" "chef hands placing a micro herb garnish onto a plate with tweezers in a dark kitchen pass" 1920 1080 303
run "hero-4" "a crystal coupe cocktail with a smoked orange peel beside a dark marble bar top" 1920 1080 404
run "hero-1" "overhead hero shot of a seared wagyu beef fillet with charred leek and bone marrow jus on a dark ceramic plate" 1920 1080 101
run "special-1" "roasted scallops with brown butter cauliflower puree and caviar on a slate plate" 900 1125 505
run "special-2" "slow braised lamb shoulder with charred onion petals and red wine reduction" 900 1125 606
run "special-3" "dark chocolate and olive oil tart with gold leaf and creme fraiche quenelle" 900 1125 707
run "about-room" "an elegant restaurant interior detail, arched window, linen table, single candle, warm light" 1200 1500 808
run "menu-starter" "burrata with heirloom tomato confit and basil oil on a stone plate" 800 800 909
run "menu-main" "pan roasted duck breast with cherry gastrique and parsnip puree" 800 800 111
run "menu-dessert" "vanilla bourbon creme brulee with a caramelised sugar crust and berries" 800 800 222
run "gallery-1" "a sommelier pouring red wine into a glass at a candlelit table" 800 1000 333
run "gallery-2" "an open flame grill in a professional kitchen with sparks and smoke" 800 600 444
run "gallery-3" "a dessert trolley detail with pastries under warm light" 800 600 555
run "og-card" "a luxurious plated tasting menu course on dark stone, centered composition" 1200 630 666

echo "done"
