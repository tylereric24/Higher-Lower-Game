"""Terminal version of the game. Uses the same dataset as the app (src/data/seasons.json)."""
import json
import os
import random
import time
from pathlib import Path

from art import logo

DATA_PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "seasons.json"
DIFFICULTY_LIVES = {"easy": 10, "medium": 7, "hard": 5}


def load_seasons():
    """Passing TD seasons as dicts: name, team, year, touchdowns."""
    raw = json.loads(DATA_PATH.read_text())
    seasons = []
    for season_id, value in raw["stats"]["passTd"]:
        player, team, year, _position = raw["seasons"][season_id]
        seasons.append({
            "name": raw["players"][player],
            "team": raw["teams"][team],
            "year": year,
            "touchdowns": value,
        })
    return seasons


def ask(prompt, valid):
    """Re-prompt until the answer is one of `valid`."""
    while True:
        answer = input(prompt).strip().lower()
        if answer in valid:
            return answer
        print(f"Please answer one of: {', '.join(valid)}")


def pick_pair(seasons):
    """Two different player-seasons with different totals."""
    qb1 = random.choice(seasons)
    qb2 = random.choice(seasons)
    while qb2["name"] == qb1["name"] or qb2["touchdowns"] == qb1["touchdowns"]:
        qb2 = random.choice(seasons)
    return qb1, qb2


def countdown_timer(seconds=3):
    for remaining in range(seconds, 0, -1):
        print(f"\nNext question in {remaining}")
        time.sleep(1)
    os.system("cls" if os.name == "nt" else "clear")


def play_game(seasons, lives):
    score = 0
    while lives > 0:
        qb1, qb2 = pick_pair(seasons)
        print(f"CURRENT SCORE: {score}  LIVES: {lives}")
        print("Who had more passing touchdowns?")
        print(f"  A: {qb1['name']} with the {qb1['team']} in {qb1['year']}")
        print(f"  B: {qb2['name']} with the {qb2['team']} in {qb2['year']}")
        answer = ask("Answer 'a' or 'b': ", ["a", "b"])

        winner, loser = (qb1, qb2) if qb1["touchdowns"] > qb2["touchdowns"] else (qb2, qb1)
        correct = "a" if winner is qb1 else "b"
        result = (f"{winner['name']} ({winner['year']}) threw {winner['touchdowns']}, "
                  f"{loser['name']} ({loser['year']}) threw {loser['touchdowns']}.")
        if answer == correct:
            score += 1
            print(f"Correct! {result}")
        else:
            lives -= 1
            print(f"Wrong! {result} {lives} lives left.")
        countdown_timer()
    print(f"You ran out of lives! Your final score was {score}")


def main():
    print(logo)
    seasons = load_seasons()
    if ask("Would you like to play a game? 'y' or 'n' ", ["y", "n"]) == "n":
        print("goodbye")
        return
    difficulty = ask("What difficulty? 'easy', 'medium' or 'hard' ", list(DIFFICULTY_LIVES))
    play_game(seasons, DIFFICULTY_LIVES[difficulty])


if __name__ == "__main__":
    main()
