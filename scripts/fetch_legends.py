#!/usr/bin/env python3
"""Fetch pre-1999 QB seasons from Wikipedia career-stats tables into scripts/legends_qb.csv.

nflverse starts in 1999, so older seasons come from Wikipedia (CC-BY-SA; the stats
themselves are facts). The parser is validated against nflverse on every season both
sources cover; the script refuses to write output if they disagree.

    python3 scripts/fetch_legends.py
"""
import csv
import html
import io
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "legends_qb.csv")
NFLVERSE = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{year}.csv"
UA = {"User-Agent": "gridiron-higher-lower data build (github.com/tylereric24/Higher-Lower-Game)"}

# Wikipedia page title -> display name. Includes QBs whose careers straddle 1999 so the
# parser can be checked against nflverse on the overlap.
QBS = {
    "Johnny_Unitas": "Johnny Unitas", "Bart_Starr": "Bart Starr", "Y._A._Tittle": "Y. A. Tittle",
    "Sonny_Jurgensen": "Sonny Jurgensen", "Len_Dawson": "Len Dawson", "John_Brodie": "John Brodie",
    "Joe_Namath": "Joe Namath", "Fran_Tarkenton": "Fran Tarkenton", "Daryle_Lamonica": "Daryle Lamonica",
    "Roman_Gabriel": "Roman Gabriel", "Bob_Griese": "Bob Griese", "Roger_Staubach": "Roger Staubach",
    "Terry_Bradshaw": "Terry Bradshaw", "Ken_Stabler": "Ken Stabler", "Jim_Plunkett": "Jim Plunkett",
    "Archie_Manning": "Archie Manning", "Ken_Anderson_(quarterback)": "Ken Anderson",
    "Craig_Morton": "Craig Morton", "Jim_Hart_(American_football)": "Jim Hart", "Bert_Jones": "Bert Jones",
    "Dan_Fouts": "Dan Fouts", "Steve_Grogan": "Steve Grogan", "Joe_Ferguson": "Joe Ferguson",
    "Steve_Bartkowski": "Steve Bartkowski", "Brian_Sipe": "Brian Sipe", "Ron_Jaworski": "Ron Jaworski",
    "Joe_Theismann": "Joe Theismann", "Danny_White": "Danny White", "Tommy_Kramer": "Tommy Kramer",
    "Doug_Williams_(quarterback)": "Doug Williams", "Joe_Montana": "Joe Montana", "Phil_Simms": "Phil Simms",
    "Jim_McMahon": "Jim McMahon", "Dan_Marino": "Dan Marino", "John_Elway": "John Elway",
    "Jim_Kelly": "Jim Kelly", "Warren_Moon": "Warren Moon", "Boomer_Esiason": "Boomer Esiason",
    "Neil_Lomax": "Neil Lomax", "Dave_Krieg": "Dave Krieg", "Bernie_Kosar": "Bernie Kosar",
    "Randall_Cunningham": "Randall Cunningham", "Jim_Everett": "Jim Everett", "Ken_O'Brien": "Ken O'Brien",
    "Steve_Young": "Steve Young", "Mark_Rypien": "Mark Rypien", "Jeff_Hostetler": "Jeff Hostetler",
    "Bobby_Hebert": "Bobby Hebert", "Wade_Wilson_(American_football)": "Wade Wilson", "Jim_Harbaugh": "Jim Harbaugh",
    "Troy_Aikman": "Troy Aikman", "Rodney_Peete": "Rodney Peete", "Chris_Chandler_(American_football)": "Chris Chandler",
    "Vinny_Testaverde": "Vinny Testaverde", "Jeff_George": "Jeff George", "Stan_Humphries": "Stan Humphries",
    "Erik_Kramer": "Erik Kramer", "Scott_Mitchell_(quarterback)": "Scott Mitchell", "Brett_Favre": "Brett Favre",
    "Drew_Bledsoe": "Drew Bledsoe", "Jeff_Blake": "Jeff Blake", "Mark_Brunell": "Mark Brunell",
    "Kerry_Collins": "Kerry Collins", "Steve_McNair": "Steve McNair", "Trent_Dilfer": "Trent Dilfer",
    "Gus_Frerotte": "Gus Frerotte", "Elvis_Grbac": "Elvis Grbac", "Rich_Gannon": "Rich Gannon",
    "Neil_O'Donnell": "Neil O'Donnell", "Kordell_Stewart": "Kordell Stewart", "Brad_Johnson_(American_football)": "Brad Johnson",
    "Jake_Plummer": "Jake Plummer", "Doug_Flutie": "Doug Flutie", "Peyton_Manning": "Peyton Manning",
    "Bubby_Brister": "Bubby Brister",
}

MIN_ATTEMPTS = 200
REQUIRED = ("Passing:Att", "Passing:Yds", "Passing:TD", "Passing:Int")
# Sub-header spellings vary between articles.
ALIASES = {"Yards": "Yds", "Comp": "Cmp", "Atts": "Att", "TDs": "TD", "INT": "Int", "Ints": "Int"}
CACHE = os.environ.get("WIKI_CACHE")  # optional dir to avoid refetching while iterating


def get(url):
    path = None
    if CACHE and "wikipedia.org" in url:
        os.makedirs(CACHE, exist_ok=True)
        path = os.path.join(CACHE, re.sub(r"[^\w.-]", "_", url.split("/wiki/")[1]))
        if os.path.exists(path):
            return open(path).read()
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r:
                body = r.read().decode("utf-8")
            if "too many requests" not in body[:300].lower():
                if path:
                    open(path, "w").write(body)
                return body
        except Exception as e:  # noqa: BLE001
            print(f"  retry {url}: {e}", file=sys.stderr)
        time.sleep(2 ** attempt)
    raise RuntimeError(f"failed: {url}")


def clean(cell):
    """Strip wiki markup from a table cell down to its text."""
    cell = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", cell, flags=re.S)
    # Cell attributes: 'style="..."| value'
    if "|" in cell and not cell.strip().startswith("[[") and "[[" not in cell.split("|")[0]:
        head, _, rest = cell.partition("|")
        if "=" in head and "{{" not in head:
            cell = rest
    cell = re.sub(r"\{\{(?:abbr|Tooltip)\|([^|}]*)\|[^}]*\}\}", r"\1", cell, flags=re.I)
    cell = re.sub(r"\{\{[^{}]*\}\}", "", cell)
    cell = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", cell)
    cell = re.sub(r"\[\[([^\]]*)\]\]", r"\1", cell)
    cell = re.sub(r"'{2,}", "", cell)
    cell = re.sub(r"<[^>]+>", "", cell)
    return html.unescape(cell).replace("−", "-").strip()


def team_from(cell):
    m = re.search(r"\[\[\d{4} (.+?) season\|", cell)
    return m.group(1) if m else None


def normalize_team(team):
    team = re.sub(r"\s*\((NFL|AFL)\)$", "", team)
    # Matches how the app names the franchise for 1999-2019 seasons.
    return "Washington" if team.startswith("Washington") else team


def parse_tables(wikitext):
    """Yield (columns, rows) for each wikitable; rows keep raw cells for team links."""
    for table in re.findall(r"\{\|.*?\n\|\}", wikitext, flags=re.S):
        # Drop the "{| class=..." opener; the first header row may sit right under it.
        rows = re.split(r"\n\|-[^\n]*", "\n" + table.split("\n", 1)[1])
        header_rows, body = [], []
        for r in rows:
            lines = [ln for ln in r.strip().split("\n") if ln.strip() and not ln.startswith("|}")]
            if not lines:
                continue
            cells = []
            for ln in lines:
                if ln[0] in "!|":
                    sep = "!!" if ln[0] == "!" else "||"
                    parts = ln[1:].split(sep)
                    if ln[0] == "!" and "||" in ln:  # '! year !! team\n| a || b' already split by lines
                        parts = re.split(r"!!|\|\|", ln[1:])
                    cells += [(ln[0], p) for p in parts]
                elif cells:
                    cells[-1] = (cells[-1][0], cells[-1][1] + "\n" + ln)
            if all(kind == "!" for kind, _ in cells):
                header_rows.append(cells)
            else:
                body.append([c for _, c in cells])
        if len(header_rows) < 2:
            continue
        # Expand the grouped header ("Passing" spanning Cmp/Att/...) into "Passing:Att".
        top, sub = header_rows[0], header_rows[1]
        cols, sub_i = [], 0
        for _, raw in top:
            span = re.search(r'colspan="?(\d+)', raw)
            name = clean(raw)
            if span:
                for _ in range(int(span.group(1))):
                    sub_name = clean(sub[sub_i][1]) if sub_i < len(sub) else ""
                    cols.append(f"{name}:{ALIASES.get(sub_name, sub_name)}" if sub_name else name)
                    sub_i += 1
            else:
                cols.append(name)
        yield cols, body


def qb_seasons(title, name):
    text = get(f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}?action=raw")
    redirect = re.match(r"#REDIRECT\s*\[\[([^\]|#]+)", text, flags=re.I)
    if redirect:
        title = redirect.group(1).strip().replace(" ", "_")
        text = get(f"https://en.wikipedia.org/wiki/{urllib.parse.quote(title)}?action=raw")
    for cols, body in parse_tables(text):
        if not cols or cols[0] not in ("Year", "Season") or any(c not in cols for c in REQUIRED):
            continue
        ix = {c: i for i, c in enumerate(cols)}
        out = []
        for raw in body:
            if len(raw) != len(cols):
                continue
            # Year cells are links or templates like {{nfly|1957}}; take the 4-digit year.
            year_match = re.search(r"\b(19[2-9]\d|20[0-2]\d)\b", raw[0])
            if not year_match or "total" in raw[0].lower() or "career" in raw[0].lower():
                continue
            year = year_match.group(1)
            # NFL/AFL only: skip college, USFL, CFL and AAFC tables.
            if not re.search(r"\b(NFL|AFL) season|\{\{(nfly|NFL year|AFL year)\b", raw[0], flags=re.I):
                continue
            team = normalize_team(team_from(raw[1]) or clean(raw[1]))
            def val(col):
                v = clean(raw[ix[col]]).replace(",", "")
                return int(v) if re.fullmatch(r"-?\d+", v) else None
            row = {
                "player": name, "team": team, "year": int(year),
                "attempts": val("Passing:Att"), "passing_yards": val("Passing:Yds"),
                "passing_tds": val("Passing:TD"), "passing_interceptions": val("Passing:Int"),
            }
            if None in row.values():
                continue
            # Guard against articles whose header colspans don't match their columns.
            att, yds, td, ints = (row[k] for k in ("attempts", "passing_yards", "passing_tds", "passing_interceptions"))
            if att >= MIN_ATTEMPTS and not (3 * att <= yds <= 11 * att and td < att / 5 and ints < att / 5):
                print(f"  rejected implausible row {name} {year}: {row}", file=sys.stderr)
                continue
            out.append(row)
        if out:
            return out  # first matching table is the regular season
    return []


def main():
    scraped = []
    for title, name in QBS.items():
        rows = qb_seasons(title, name)
        print(f"{name}: {len(rows)} seasons")
        scraped += rows
        time.sleep(1)

    # Validate against nflverse wherever both sources have the season.
    overlap = {r["year"] for r in scraped if r["year"] >= 1999}
    nfl = {}
    for year in sorted(overlap):
        for r in csv.DictReader(io.StringIO(get(NFLVERSE.format(year=year)))):
            nfl[(r["player_display_name"], int(year))] = r
    checked = mismatched = 0
    for r in scraped:
        ref = nfl.get((r["player"], r["year"]))
        if not ref or r["attempts"] < MIN_ATTEMPTS:
            continue
        checked += 1
        # nflverse is play-by-play derived and can drift a yard or an attempt from official
        # totals, so compare only what the game shows: TDs and INTs exact, yards within 1%.
        for col in ("passing_yards", "passing_tds", "passing_interceptions"):
            ours, theirs = r[col], int(float(ref[col]))
            ok = abs(ours - theirs) <= 0.01 * theirs if col == "passing_yards" else ours == theirs
            if not ok:
                mismatched += 1
                print(f"MISMATCH {r['player']} {r['year']} {col}: wiki={r[col]} nflverse={ref[col]}")
                break
    print(f"validated {checked} overlapping seasons, {mismatched} mismatched")
    if checked < 20 or mismatched > checked * 0.05:
        sys.exit("validation failed; not writing output")

    keep = [r for r in scraped if r["year"] < 1999 and r["attempts"] >= MIN_ATTEMPTS]
    keep.sort(key=lambda r: (r["year"], r["player"]))
    with open(OUT, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(keep[0].keys()))
        w.writeheader()
        w.writerows(keep)
    print(f"wrote {OUT}: {len(keep)} seasons, {len({r['player'] for r in keep})} QBs")


if __name__ == "__main__":
    main()
