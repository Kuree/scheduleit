import requests 
import re
from bs4 import BeautifulSoup
import json
import time
from time import mktime
from datetime import datetime
import os.path
import os
import glob
import copy
import sys

TEMP_FILE_FOLDER = "../temp/bucknell"
SCHOOL_NAME = "bucknell"
BAN_LIST = ["OPEN", "OFFG", "OFFD", "OFFF", "OFFL", "LEGL", "FLMS"]

def html_get_text(t):
    return t.get_text().encode("ascii", "ignore").strip()
  
def parse_raw_hour(raw_time):
    # made some bold assumption here
    # need to check carefully
    # assume all times have the same "pm" or "am"
    time_range = raw_time.split("-")
    if len(time_range) == 1:
        return 0
    start_time_raw = time_range[0]
    end_time_raw = time_range[1]
	# very special case here
	# see issue #11
    if end_time_raw[:2] == "12" and start_time_raw[:2] == "11":
        start_time_raw += "am"
    else:
        start_time_raw += end_time_raw[-2:]
    # for bucknell, end times are always 22 or 52
    start_time = time.strptime(start_time_raw, "%I:%M%p")
    end_time = time.strptime(end_time_raw, "%I:%M%p")
    time_diff = (end_time.tm_hour - start_time.tm_hour) * 60 + (end_time.tm_min - start_time.tm_min) 
    time_diff_minute = time_diff + 8
    time_range = time_diff_minute // 30
    # the bit counting starts from 8:00, ends in 24:00
    start_hour = start_time.tm_hour + (0 if start_time.tm_min == 0 else 0.5)
    start_bit = int((start_hour - 8) * 2)
    result = 0
    for i in range(time_range):
        result |= (1 << (start_bit + i))
    return result;

def parse_meeting_time(raw_time):
    parse_result = []
    for time_entry in raw_time.split('\n'):
        day_dict = {"M" : 0, "T": 0, "W": 0,"R": 0, "F" : 0}
        times = time_entry.split(' ')
        day_of_week = times[0]
        hour_of_day = times[1]
        for day in day_of_week:
            day_dict[day] = parse_raw_hour(hour_of_day)

        parse_result.append(day_dict)

    # currently flatten the list
    # may consider non-flatten list
    day_flattern_dict = {"M" : 0, "T": 0, "W": 0,"R": 0, "F" : 0}
    result = []
    for day in day_flattern_dict:
        for entry in parse_result:
            day_flattern_dict[day] |= entry[day]
    return [day_flattern_dict["M"]] + [day_flattern_dict["T"]] + [day_flattern_dict["W"]] + [day_flattern_dict["R"]]+[day_flattern_dict["F"]]
    
    
def linking_class(course_table, course_entry):
    raw_names = course_entry["n"].split()
    name = raw_names[0] + " " + raw_names[1]
    course_entry["l"] = {}
    if name[-1] == "R" or name[-1] == "L" or name[-1] == "P":
        return
    for course in course_table:
        name_token = course["Course"].split()
        tag = name_token[0] + " " + name_token[1]
        if tag[-1] == "R" or tag[-1] == "L" or tag[-1] == "P":
            if tag[:-1] == name:
                crn = course["CRN"]
                if tag not in course_entry["l"]:
                    course_entry["l"][tag] = [crn]
                else:
                    course_entry["l"][tag].append(crn)
    
    
def process_course_table(course_table):
    course_result = {}
    search_result = []
    tag_search_result = {}
    for course_entry in course_table:
        if not course_entry["CRN"].isdigit():
            continue
        new_entry = {}
        new_entry["i"] = course_entry["Instructor"]
        # in case of multiple rooms. The number of entries should match the meeting time
        new_entry["r"] = course_entry["Room"].split('\n') 
        new_entry["n"] = course_entry["Course"]
        time_entry = course_entry["Meeting Time"]
        if time_entry == "":
            continue
        new_entry["t"] = parse_meeting_time(time_entry) if time_entry != "TBA" else [0, 0, 0, 0, 0]
        
        crn = course_entry["CRN"]
        
        # add search tag
        # NOTE: CHOOSE A DIFFERENT IMPLEMENTATION TO IMPROVE LOAD TIME
        # course_name_tokens = new_entry["n"].split()
        # course_search_name = course_name_tokens[0] + " " + course_name_tokens[1]
        # new_entry["s"] = [crn, course_search_name]
        
        # linking all the classes together
        # only for search, need to delete the field after finishing the search list
        linking_class(course_table, new_entry)
        
        course_result[crn] = new_entry
        
        title = course_entry["Title"]
        
        # process the search list
        # each entry format
        
        # note for performance purpose
        # CRN list doesn't have description and title
        # the front-end will pull it from the course
        # also note that most classes doesn't have linked class
        # remove it from the JSON will reduce the size
        # It has two reasons. 1. using CRN to store description or title will cause duplication.
        # most people will use course name rather than CRN
        # nn is the real name, including all the session name
        name = new_entry["n"]
        name_tokens =name.split()
        name = name_tokens[0] + " " + name_tokens[1]
        is_linked_list = False
        if name[-1] == "R" or name[-1] == "L" or name[-1] == "P": 
            # need to add it to the course list
            is_linked_list = True
            
        # handle tag search
        if course_entry["CCCReq"] and course_entry["CCCReq"] != "":
            for ccc in course_entry["CCCReq"].split():
                if ccc in tag_search_result:
                    if name not in tag_search_result[ccc]:
                        tag_search_result[ccc].append(name)
                else:
                    tag_search_result[ccc] = [name]
            
        if len(new_entry["l"]) > 0:
            search_result.append({"n" : crn, "l" : new_entry["l"], "crn" : [crn], "nn" : new_entry["n"]})
        else:
            if is_linked_list:
                search_result.append({"n" : crn, "crn" : [crn], "is_l" : is_linked_list, "nn" : new_entry["n"]})
            else:
                search_result.append({"n" : crn, "crn" : [crn], "nn" : new_entry["n"]})
        existing_list = [x for x in search_result if x["n"] == name]
        
        if len(existing_list) == 0:
            if len(new_entry["l"]) > 0:
                entry = {"n" : name, "d" : course_entry["desc"], "l" : new_entry["l"], "crn" : [crn], "ti" : title}
            else:
                if is_linked_list:
                    entry = {"n" : name, "crn" : [crn], "ti" : title, "is_l" : is_linked_list, "d" : course_entry["desc"]}
                else:
                    entry = {"n" : name, "d" : course_entry["desc"], "crn" : [crn], "ti" : title}
            search_result.append(entry)
        else:
            existing_list[0]["crn"].append(crn)
            
        
    # deleting the l entry in the course_result
    for key in course_result:
        course = course_result[key]
        del course["l"]
        
    print "Finished processing tables" 
    return course_result, search_result, tag_search_result

def get_desc(term, dept, course_number):
    query_str = "https://www.bannerssb.bucknell.edu/ERPPRD/bwckctlg.p_disp_course_detail?cat_term_in=" + term +\
    "&subj_code_in=" + dept + "&crse_numb_in=" + course_number
    r_desc_text = requests.get(query_str).text.encode('utf-8')
    p = re.compile(ur'\<td class=\"ntdefault\"\>\n(?P<desc>.*)', re.IGNORECASE)
    match = re.search(p,  r_desc_text)
    return match.group('desc')
    
def main():
    if len(sys.argv) < 2:
        print "Please input term number"
        exit()
    term = sys.argv[1]
    # check the temp folder
    temp_path = TEMP_FILE_FOLDER
    if not os.path.exists(temp_path):
        os.makedirs(temp_path)

    r_dept = requests.get("https://www.bannerssb.bucknell.edu/ERPPRD/hwzkschd.P_Bucknell_SchedbyDept")
    r_dept_text = r_dept.text.encode("utf-8")
    pattern = r'value=\"(\w{4})\"'
    dept_search = re.findall(pattern, r_dept_text, re.I)
    # print r_dept_text
    course_table = []
    if dept_search:
        print(dept_search)
        for dept in dept_search:
            # OPEN contains in the dept as well. need to exclude it
            if dept in BAN_LIST: continue
            
            if os.path.isfile(TEMP_FILE_FOLDER + "/" + dept + ".json"):
                print "Load from temp file", dept
                continue
            
            payload = {
                'lookopt' : 'DPT',
                'frstopt' : '',
                'term' : term,
                'param1' : dept,
                'openopt' : 'ALL'}
            r_form = requests.post("https://www.bannerssb.bucknell.edu/ERPPRD/hwzkschd.P_Bucknell_SchedDisplay", 
                    data=payload)

            form_text = r_form.text#.encode("utf-8")
            # TODO:
            # one thing to notice is that even if you query an invalid dept,
            # it will still return status as 200, yet there's no content
            soup = BeautifulSoup(form_text, "html5lib")
            table = soup.find("table", attrs = {"id" : "coursetable"})
            if table is None:
                # this is an abnormal one
                # need to manually check
                print "ERROR DEPT: ", dept
                continue
            else:
                print "Processing", dept
            # check if it's valid course table
            #if table is None:
            #    continue
            headings = [th.get_text().encode("ascii", "ignore") for th in table.find("tr").find_all("th")]
            datasets = []
            for row in table.find_all("tr")[1:]:
                all_td = row.find_all("td")
                if len(all_td) < 10:
                    # this is the explanation of the course
                    continue
                dataset = zip(headings, (html_get_text(td) for td in all_td))
                datasets.append(dataset)
            
            dept_table = []
            
            for entry in datasets:
                if len(entry) <= 2:
                    continue
                
                entry_dic = {}
                for x in entry:
                    entry_dic[x[0]] = x[1]
                    
                
                # get description
                course_number = entry_dic["Course"].split()[1]
                desc = get_desc(term, dept, course_number)
                entry_dic["desc"] = desc
                dept_table.append(entry_dic)
                
                    
            with open(TEMP_FILE_FOLDER + "/" + dept + ".json", "w") as f:
                json.dump(dept_table, f)
                print dept, "dumped"
                

    else:
        print "error"
        return
        
    for filename in glob.glob(TEMP_FILE_FOLDER + "/*.json"):
        with open(filename) as f:
            for entry in json.load(f):
                course_table.append(entry)
    result, search, tag_result = process_course_table(course_table)
    
    # create a folder if it doesn't exit
    path = "../data/" + SCHOOL_NAME
    if not os.path.exists(path):
        os.makedirs(path)
    
    term_num = int(term[-1])
    if term_num == 1:
        term_name = str(int(term[:4]) - 1) + "-fall"
    else:
        term_name = term[:4] + "-spring"
    
    with open(path +  "/" + term_name + "-courses.json", 'w') as f:
        json.dump(result, f, separators=(',',':'))
        print "course file dumped"
        
    with open(path +  "/" + term_name + "-search.json", 'w') as f:
        json.dump(search, f, separators=(',',':'))
        print "search file dumped"
        
    with open(path +  "/" + term_name + "-tag.json", 'w') as f:
        json.dump(tag_result, f, separators=(',',':'))
        print "tag search file dumped"
        
    

        
if __name__ == "__main__":
    main()
