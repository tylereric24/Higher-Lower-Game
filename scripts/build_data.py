#!/usr/bin/env python3
"""Build src/data/seasons.json from nflverse season stats.

Data source: nflverse-data (https://github.com/nflverse/nflverse-data), CC-BY 4.0.
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

BASE = "https://github.com/nflverse/nflverse-data/releases/download"
LEGACY_URL = f"{BASE}/player_stats/player_stats_season.csv"  # 1999-2024
NEW_URL = f"{BASE}/stats_player/stats_player_reg_{{year}}.csv"  # 2025+
LEGACY_LAST = 2024

OUT = os.path.join(os.path.dirname(__file__), "..", "src", "data", "seasons.json")

# category key -> (csv column, qualifier(row) -> bool, top-N per season counted as "star")
CATEGORIES = {
    "passTd": ("passing_tds", lambda r: num(r, "attempts") >= 200, 12),
    "passYd": ("passing_yards", lambda r: num(r, "attempts") >= 200, 12),
    "rushYd": ("rushing_yards", lambda r: num(r, "rushing_yards") >= 500, 12),
    "recYd": ("receiving_yards", lambda r: num(r, "receiving_yards") >= 600, 15),
    "rec": ("receptions", lambda r: num(r, "receptions") >= 50, 15),
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

# Pre-1999 seasons nflverse doesn't cover. Hand-verified passing TD totals carried over
# (and corrected) from the original game data.
LEGENDS = [
    ("George Blanda", "Houston Oilers", 1961, 36),
    ("Fran Tarkenton", "New York Giants", 1967, 29),
    ("Joe Montana", "San Francisco 49ers", 1982, 17),
    ("Dan Marino", "Miami Dolphins", 1986, 44),
    ("Joe Montana", "San Francisco 49ers", 1987, 31),
    ("Jim Everett", "Los Angeles Rams", 1989, 29),
    ("Troy Aikman", "Dallas Cowboys", 1992, 23),
]


def num(row, col):
    v = row.get(col) or "0"
    try:
        return int(float(v))
    except ValueError:
        return 0


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
    if args.first <= LEGACY_LAST:
        rows += [r for r in fetch(LEGACY_URL)
                 if r["season_type"] == "REG" and args.first <= int(r["season"]) <= min(args.last, LEGACY_LAST)]
    for year in range(max(args.first, LEGACY_LAST + 1), args.last + 1):
        rows += fetch(NEW_URL.format(year=year))

    players, teams, seasons = [], [], []
    player_idx, team_idx, season_idx = {}, {}, {}
    stats = {k: [] for k in CATEGORIES}

    def intern(lst, idx, key):
        if key not in idx:
            idx[key] = len(lst)
            lst.append(key)
        return idx[key]

    def season_id(name, team, year):
        key = (name, team, year)
        if key not in season_idx:
            season_idx[key] = len(seasons)
            seasons.append([intern(players, player_idx, name), intern(teams, team_idx, team), year])
        return season_idx[key]

    for cat, (col, qualifies, top_n) in CATEGORIES.items():
        by_year = {}
        for r in rows:
            if qualifies(r):
                by_year.setdefault(int(r["season"]), []).append(r)
        for year, yr_rows in sorted(by_year.items()):
            yr_rows.sort(key=lambda r: -num(r, col))
            for rank, r in enumerate(yr_rows):
                sid = season_id(r["player_display_name"], team_name(r["recent_team"], year), year)
                stats[cat].append([sid, num(r, col), 1 if rank < top_n else 0])

    for name, team, year, tds in LEGENDS:
        stats["passTd"].append([season_id(name, team, year), tds, 1])

    out = {
        "source": "nflverse-data (CC-BY 4.0), regular season",
        "range": [args.first, args.last],
        "players": players,
        "teams": teams,
        "seasons": seasons,
        "stats": stats,
    }
    with open(OUT, "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(f"wrote {OUT}: {len(seasons)} seasons, " +
          ", ".join(f"{k}={len(v)}" for k, v in stats.items()))


if __name__ == "__main__":
    main()
