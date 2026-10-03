#!/usr/bin/env python3
"""Build src/data/seasons.json.

Sources:
- nflverse-data (https://github.com/nflverse/nflverse-data), CC-BY 4.0: every regular
  season from 1999, offense, defense and kicking.
- scripts/legends_qb.csv: pre-1999 QB seasons from Wikipedia, produced and validated
  by scripts/fetch_legends.py.

Standard library only. Usage:

    python3 scripts/build_data.py [--first 1999] [--last 2025]

Only completed regular seasons should be included; bump --last after each Super Bowl.
"""
import argparse
import csv
import io
import json
import os
import urllib.request

HERE = os.path.dirname(__file__)
URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_{year}.csv"
LEGENDS = os.path.join(HERE, "legends_qb.csv")
OUT = os.path.join(HERE, "..", "src", "data", "seasons.json")


def num(row, col):
    try:
        return float(row.get(col) or 0)
    except ValueError:
        return 0.0


# key -> (csv column, qualifier). Must match CATEGORIES in src/data.ts.
CATEGORIES = {
    "passTd": ("passing_tds", lambda r: num(r, "attempts") >= 200),
    "passYd": ("passing_yards", lambda r: num(r, "attempts") >= 200),
    "passInt": ("passing_interceptions", lambda r: num(r, "attempts") >= 200),
    "rushYd": ("rushing_yards", lambda r: num(r, "rushing_yards") >= 500),
    "rushTd": ("rushing_tds", lambda r: num(r, "carries") >= 100),
    "recYd": ("receiving_yards", lambda r: num(r, "receiving_yards") >= 500),
    "rec": ("receptions", lambda r: num(r, "receptions") >= 40),
    "recTd": ("receiving_tds", lambda r: num(r, "receptions") >= 40),
    "fantasy": ("fantasy_points_ppr", lambda r: num(r, "fantasy_points_ppr") >= 150),
    "sacks": ("def_sacks", lambda r: num(r, "def_sacks") >= 5),
    "defInt": ("def_interceptions", lambda r: num(r, "def_interceptions") >= 3),
    "fgMade": ("fg_made", lambda r: num(r, "fg_att") >= 15),
}

# nflverse's play-by-play derivation disagrees with the official record on a few seasons.
# (player, year, column) -> official value. Each one is cross-checked by fetch_legends.py.
OVERRIDES = {
    ("Elvis Grbac", 2000, "passing_yards"): 4169,
}

TEAMS = {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs", "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings",
    "NE": "New England Patriots", "NO": "New Orleans Saints", "NYG": "New York Giants",
    "NYJ": "New York Jets", "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers",
    "SEA": "Seattle Seahawks", "SF": "San Francisco 49ers", "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans",
}


def team_name(abbr, year):
    """nflverse normalizes relocated franchises to current codes; restore era-correct names."""
    if abbr == "LV":
        return "Oakland Raiders" if year < 2020 else "Las Vegas Raiders"
    if abbr == "LAC":
        return "San Diego Chargers" if year < 2017 else "Los Angeles Chargers"
    if abbr == "LA":
        return "St. Louis Rams" if year < 2016 else "Los Angeles Rams"
    if abbr == "WAS":
        if year >= 2022:
            return "Washington Commanders"
        return "Washington Football Team" if year >= 2020 else "Washington"
    return TEAMS[abbr]


def position(row):
    """Position group, except specialists keep their exact role (K, P)."""
    group = row.get("position_group") or ""
    return row.get("position") or group if group == "SPEC" else group


def fetch(url):
    print(f"fetching {url}")
    with urllib.request.urlopen(url) as resp:
        return list(csv.DictReader(io.StringIO(resp.read().decode("utf-8"))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--first", type=int, default=1999)
    ap.add_argument("--last", type=int, default=2025)
    args = ap.parse_args()

    rows = []
    for year in range(args.first, args.last + 1):
        rows += [r for r in fetch(URL.format(year=year)) if r.get("recent_team") in TEAMS or
                 r.get("recent_team") in ("LV", "LAC", "LA", "WAS")]
    for r in rows:
        for (player, year, col), value in OVERRIDES.items():
            if r["player_display_name"] == player and int(r["season"]) == year:
                r[col] = str(value)

    players, teams, positions, seasons = [], [], [], []
    interned = {}
    season_idx = {}
    stats = {k: [] for k in CATEGORIES}

    def intern(lst, key):
        k = (id(lst), key)
        if k not in interned:
            interned[k] = len(lst)
            lst.append(key)
        return interned[k]

    def season_id(name, team, year, pos):
        key = (name, team, year)
        if key not in season_idx:
            season_idx[key] = len(seasons)
            seasons.append([intern(players, name), intern(teams, team), year, intern(positions, pos)])
        return season_idx[key]

    def value(v):
        return int(v) if v == int(v) else v  # half sacks stay 0.5-precise

    for cat, (col, qualifies) in CATEGORIES.items():
        for r in rows:
            if qualifies(r):
                year = int(r["season"])
                sid = season_id(r["player_display_name"], team_name(r["recent_team"], year), year, position(r))
                stats[cat].append([sid, value(num(r, col))])

    with open(LEGENDS) as f:
        for r in csv.DictReader(f):
            sid = season_id(r["player"], r["team"], int(r["year"]), "QB")
            stats["passTd"].append([sid, int(r["passing_tds"])])
            stats["passYd"].append([sid, int(r["passing_yards"])])
            stats["passInt"].append([sid, int(r["passing_interceptions"])])

    out = {
        "source": "nflverse-data (CC-BY 4.0) 1999+, Wikipedia pre-1999 QBs; regular season",
        "range": [args.first, args.last],
        "players": players,
        "teams": teams,
        "positions": positions,
        "seasons": seasons,
        "stats": stats,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {OUT}: {len(seasons)} seasons, {len(players)} players, " +
          ", ".join(f"{k}={len(v)}" for k, v in stats.items()))


if __name__ == "__main__":
    main()
