# ----------------------------------------------------------------------------
# Copyright (c) PTC Inc. and/or all its affiliates. All rights reserved.
# See License.txt in the project root for license information.
# ----------------------------------------------------------------------------

# This script connects to companion Kepware Universal Device Driver profile on specified 
# IP and TCP port and watches a target directory for a CSV file of a specific name. 
#
# When the CSV file created, modified or overwritten, the script parses contents and sends 
# as plain text to a listening UDD profile.

# Expects CSV formats like:

#   column1,column2,column3[n]
#   string1,p1,50
#   string2,p2,77 

# Sends the data grouped by one selected column (e.g. column2) to the 
# configured Kepware Universal Device Driver:

#   {"p1" : {column1 : "string1", column2 : "p1", column3 : "50"}, 
#    "p2" : {column1 : "string2", column2 : "p2", column3 : "77"}}

# The data can then be accessed in Kepware using the following tag syntax:

#  p1.column1
#  p2.column3

# MAKE SURE TO EDIT FILEPATH AND FILENAME VARIABLES (lines 46 and 94)

import os
import csv
import socket
import time
import json
from watchdog.observers import Observer
from watchdog.events import PatternMatchingEventHandler


def process(header, value, record):
    key, other = header.partition('/')[::2]
    if other:
        process(other, value, record.setdefault(key, {}))
    else:
        record[key] = value

def file_reader():
        time.sleep(.25)
        filePath = './testdir/SAMPLE_DATA.csv'
        data = {}
        with open(filePath, newline='') as csvfile:
                reader = csv.DictReader(csvfile)
                for row in reader:
                        # Choose a column to group the data 
                        data[row['Characteristic']] = record = {}
                        for header, value in row.items():
                                process(header, value, record)
        return(data)

def data_sender(obj):
        # Convert dict to string representation in order to make byte encoding easy
        s_obj = json.dumps(obj)
        # Encode as bytes and send to listening Kepware UDD profile
        clientSocket.sendall(s_obj.encode())
        print(f"-- Data sent; data: {s_obj}")
                  
def on_created(event):
        print(f"-- {event.src_path} has been created")
        fileData = file_reader()
        data_sender(fileData)
        
def on_deleted(event):
        print(f"-- {event.src_path} has been deleted")
 
def on_modified(event):
        # Extra code here to handle the watchdog library bug around detecting too many modification events
        global old
        # Get the most recent modification time of file
        statbuf = os.stat(fileName)
        new = statbuf.st_mtime
        # If the second modification event happens within .5 seconds after the first, ignore it
        if (new - old) > 0.5:
                print(f"-- {event.src_path} has been modified")
                fileData = {}
                fileData = file_reader()
                data_sender(fileData)
        # Update the global variable with the current file access time for comparison during the second unexpected modificiation event
        old = new

def on_moved(event):
    print(f"{event.src_path} has moved to {event.dest_path}")

# Create a variable to store file modification time; this will be used while detecting real modification events
old = 0

# Define file path and file name to watch for
fileName = './testdir/SAMPLE_DATA.csv'

# Define Universal Device Driver listening IP and port
uddIP = '127.0.0.1'
uddPort = 60010

# Define any file name patterns using regex syntax to include or ignore
patterns = ["*"]
ignore_patterns = None
ignore_directories = False
case_sensitive = True

# Let user know we are starting
print('CSV to UDD File Watcher Starting')
time.sleep(.25)

# Connect to UDD
clientSocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
        print('-- Attempting socket connection')
        clientSocket.connect((uddIP, uddPort))
        time.sleep(.25)
        print('-- Socket established')
except Exception as e:
        print ('-- Socket failed')
        exit()

# Create an event handler
my_event_handler = PatternMatchingEventHandler(patterns, ignore_patterns, ignore_directories, case_sensitive)
my_event_handler.on_created = on_created
my_event_handler.on_deleted = on_deleted
my_event_handler.on_modified = on_modified
my_event_handler.on_moved = on_moved

# Define the Observer from the watchdog library and pass it the event handler, path and other arguments
path = "./testdir"
go_recursively = False
my_observer = Observer()
my_observer.schedule(my_event_handler, path, recursive=go_recursively)

# Start the Observer
my_observer.start()
time.sleep(.5)
print('')
print('Watching for file..')
try:
        while True:
                time.sleep(1)
except KeyboardInterrupt:
        my_observer.stop()
        my_observer.join()


