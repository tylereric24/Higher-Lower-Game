from data import data
from art import logo
import os
import random
import time
lives = 0


def main():
    print_banner()
    start_game()

def start_game():
    global lives
    start_input = input("Would you like to play a game? 'y' or 'n' ").lower()
    if start_input == 'y':
        user_diff = input("What difficulty would you like to play on? 'easy' 'medium' or 'hard'? ").lower()
        if user_diff == 'easy':
            lives = 10
        elif user_diff == 'medium':
            lives = 7
        elif user_diff == 'hard':
            lives = 5
        play_game()
    if start_game == 'n':
        print("goodbye")


def print_banner():
    print(logo)


def play_game():
    playing = True
    while playing == True:
        score = 0
        global lives
        while lives >= 1:
            QB1 = random.choice(data)
            QB2 = random.choice(data)
            if QB1 == QB2:
                QB2 = random.choice(data)
            if lives >= 1:
                name1, name2 = get_name(QB1, QB2)
                team1, team2 = get_team(QB1, QB2)
                year1, year2 = get_year(QB1, QB2)
                TD1, TD2 = get_touchdowns(QB1,QB2)
                print(f"CURRENT SCORE: {score} CURRENT LIVES: {lives}")
                user_answer = input(f"Who had more passing touchdowns? \nQB1:{name1} with the {team1} in {year1}?\nOR\nQB2:{name2} with the {team2} in {year2}?\nAnswer 'A' for {name1} 'B' for {name2} or 'C' for Their Season was Equal\n")
                correct_answer, correct_QB, correct_TD, incorrect_QB, incorrect_TD = score_game(QB1, QB2, user_answer)
                if user_answer == correct_answer:
                    score += 1
                    print(f"Correct! The answer is {correct_QB} with {correct_TD} over {incorrect_QB} with {incorrect_TD}")
                    print(f"CURRENT SCORE: {score}")
                    time.sleep(4)
                    os.system('cls' if os.name == 'nt' else 'clear')
                elif user_answer != correct_answer:
                    print(f"Wrong answer! The answer was {correct_QB} with {correct_TD} over {incorrect_QB} with {incorrect_TD}")
                    lives -= 1
                    print(f"You lost a life! {lives} left!")
                    time.sleep(4)
                    os.system('cls' if os.name == 'nt' else 'clear')
                    
                else:
                    print(f"I am not sure what you typed but the answer is {correct_QB} with {correct_TD} over {incorrect_QB} with {incorrect_TD}")
                    time.sleep(4)
                    os.system('cls' if os.name == 'nt' else 'clear')
                    score -= 1
                    lives -= 1
            else:
                print(f"You ran out of lives! Your final score was {score}")
                playing = False  


def get_name(QB1, QB2):
    name1 = QB1['name']
    name2 = QB2['name']
    return name1, name2
    

def get_team(QB1, QB2):
    team1 = QB1['team']
    team2 = QB2['team']
    return team1, team2

def get_year(QB1, QB2):
    year1 = QB1['year']
    year2 = QB2['year']
    return year1, year2

def get_touchdowns(QB1, QB2):
    TD1 = QB1['touchdowns']
    TD2 = QB2['touchdowns']
    return TD1, TD2

def score_game(QB1, QB2, user_answer):
    TD1 = QB1['touchdowns']
    TD2 = QB2['touchdowns']
    name1 = QB1['name']
    name2 = QB2['name']
    correct_QB = None
    incorrect_QB = None
    correct_TD = None
    incorrect_TD = None
    if TD1 > TD2:
        correct_answer = 'A'
        correct_QB = name1
        correct_TD = TD1
        incorrect_QB = name2
        incorrect_TD = TD2
    elif TD2 > TD1:
        correct_answer = 'B'
        correct_QB = name2
        correct_TD = TD2
        incorrect_QB = name1
        incorrect_TD = TD1
    elif TD1 == TD2:
        correct_answer = 'C'
    return correct_answer, correct_QB, correct_TD, incorrect_QB, incorrect_TD

    
    



if __name__ == '__main__':
    main()
