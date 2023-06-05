from data import data #importing data for game from other module 
from art import logo #importing ascii logo from other module
import os #importing os to utilize clear screen
import random 
import time
lives = 0


def main():
    print_banner() #calls function to print game logo
    start_game() #starts the game

def start_game():
    global lives #using global lives variable
    start_input = input("Would you like to play a game? 'y' or 'n' ").lower()
    if start_input == 'y':
        user_diff = input("What difficulty would you like to play on? 'easy' 'medium' or 'hard'? ").lower()
        if user_diff == 'easy':
            lives = 10
        elif user_diff == 'medium':
            lives = 7
        elif user_diff == 'hard':
            lives = 5
        play_game() #starting the game loop
    if start_input == 'n': 
        print("goodbye")


def print_banner():
    print(logo) #prints the games logos 


def play_game():
    playing = True
    score = 0
    while playing == True:
        global lives
        while lives >= 1:
            #Randomly selects QB1 and QB2 from data
            QB1 = random.choice(data)
            QB2 = random.choice(data)
            if QB1 == QB2:
                #if QB2 is the same as QB1 reselects QB2 so game will work
                QB2 = random.choice(data)
            if lives >= 1:
                name1, name2 = get_name(QB1, QB2) #gets names of QBs
                team1, team2 = get_team(QB1, QB2) #gets teams of QB1 and QB2
                year1, year2 = get_year(QB1, QB2) #gets year of season
                TD1, TD2 = get_touchdowns(QB1,QB2)
                print(f"CURRENT SCORE: {score} CURRENT LIVES: {lives}")
                user_answer = input(f"Who had more passing touchdowns? \nQB1:{name1} with the {team1} in {year1}?\nOR\nQB2:{name2} with the {team2} in {year2}?\nAnswer 'A' for {name1} 'B' for {name2} or 'C' for Their Season was Equal\n").lower()
                correct_answer, correct_QB, correct_TD, incorrect_QB, incorrect_TD = score_game(QB1, QB2, user_answer)
                if user_answer == correct_answer:
                    score += 1
                    print(f"Correct! The answer is {correct_QB} with {correct_TD} over {incorrect_QB} with {incorrect_TD}")
                    print(f"CURRENT SCORE: {score}")
                    #adds a delay of 4 seconds so the user has a chance to read the output
                    countdown_timer()
                    #clears the console to reduce clutter from multiple rounds
                    os.system('cls' if os.name == 'nt' else 'clear')
                elif user_answer != correct_answer:
                    print(f"Wrong answer! The answer was {correct_QB} with {correct_TD} over {incorrect_QB} with {incorrect_TD}")
                    lives -= 1
                    print(f"You lost a life! {lives} left!")
                    countdown_timer()
                    os.system('cls' if os.name == 'nt' else 'clear')
                    
                else:
                    print(f"I am not sure what you typed but the answer is {correct_QB} with {correct_TD} over {incorrect_QB} with {incorrect_TD}")
                    countdown_timer()
                    os.system('cls' if os.name == 'nt' else 'clear')
                    score -= 1
                    lives -= 1
        else:
            print(f"You ran out of lives! Your final score was {score}")
            playing = False  

#function to show user a countdown to the next question
def countdown_timer():
    countdown = 4
    for i in range(4):
        print(f"\nNext question in {countdown}")
        time.sleep(1)
        countdown -= 1
        
#function to get QB names 
def get_name(QB1, QB2):
    name1 = QB1['name']
    name2 = QB2['name']
    return name1, name2
    
#function to get teams
def get_team(QB1, QB2):
    team1 = QB1['team']
    team2 = QB2['team']
    return team1, team2
#function to get season year
def get_year(QB1, QB2):
    year1 = QB1['year']
    year2 = QB2['year']
    return year1, year2
#function to get touchdowns 
def get_touchdowns(QB1, QB2):
    TD1 = QB1['touchdowns']
    TD2 = QB2['touchdowns']
    return TD1, TD2
#function to score game and get correct answer
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
        correct_answer = 'a'
        correct_QB = name1
        correct_TD = TD1
        incorrect_QB = name2
        incorrect_TD = TD2
    elif TD2 > TD1:
        correct_answer = 'b'
        correct_QB = name2
        correct_TD = TD2
        incorrect_QB = name1
        incorrect_TD = TD1
    elif TD1 == TD2:
        correct_answer = 'c'
    return correct_answer, correct_QB, correct_TD, incorrect_QB, incorrect_TD

    
    



if __name__ == '__main__':
    main()
