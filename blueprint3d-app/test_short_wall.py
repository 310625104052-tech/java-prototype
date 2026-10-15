import math

# Test: a 50px legitimate short interior wall (e.g. bathroom wing wall or closet partition)
# connecting to wall-11 (x=112)
short_wall = {
    "id": "wall-short-1",
    "x1": 112, "y1": 500, "x2": 165, "y2": 500, # L=53px
    "thickness": 12, "orientation": "horizontal"
}

# Cabinet line (thin, only 7px, no solid core)
cabinet_line = {
    "id": "cab-1",
    "x1": 112, "y1": 550, "x2": 165, "y2": 550, # L=53px
    "thickness": 7, "orientation": "horizontal"
}

print("Short wall test passes if wall-short-1 is accepted and cab-1 is rejected.")
