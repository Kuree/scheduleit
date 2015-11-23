import requests 
import re
from bs4 import BeautifulSoup
import json
import time
from time import mktime
from datetime import datetime
import os.path

TEMP_FILE_PATH = "course_temp.json"


def html_get_text(t):
    return t.get_text().encode("ascii", "ignore").strip()
  
def parse_raw_hour(raw_time):
    # made some bold assumption here
    # need to check carefully
    # assume all times have the same "pm" or "am"
    time_range = raw_time.split("-")
    start_time_raw = time_range[0]
    end_time_raw = time_range[1]
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
    return [day_flattern_dict[key] for key in day_flattern_dict]
    
def main():
    r_dept = requests.get("https://www.bannerssb.bucknell.edu/ERPPRD/hwzkschd.P_Bucknell_SchedbyDept")
    r_dept_text = r_dept.text.encode("utf-8")
    pattern = r'value=\"(\w{4})\"'
    dept_search = re.findall(pattern, r_dept_text, re.I)
    # print r_dept_text
    course_table = []
    if dept_search and (not os.path.isfile(TEMP_FILE_PATH)):
        print(dept_search)
        for dept in dept_search:
            # OPEN contains in the dept as well. need to exclude it
            if dept == "OPEN": continue
            payload = {
                'lookopt' : 'DPT',
                'frstopt' : '',
                'term' : '201605',
                'param1' : dept,
                'openopt' : 'ALL'}
            r_form = requests.post("https://www.bannerssb.bucknell.edu/ERPPRD/hwzkschd.P_Bucknell_SchedDisplay", 
                    data=payload)

            form_text = r_form.text#.encode("utf-8")
            # TODO:
            # one thing to notice is that even if you query an invalid dept,
            # it will still return status as 200, yet there's no content
            soup = BeautifulSoup(form_text, "lxml")
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
                if len(all_td) != 14:
                    # this is the explanation of the course
                    continue
                dataset = zip(headings, (html_get_text(td) for td in all_td))
                datasets.append(dataset)
            for entry in datasets:
                if len(entry) <= 2:
                    continue
                entry_dic = {}
                for x in entry:
                    entry_dic[x[0]] = x[1]
                course_table.append(entry_dic)
                

        with open(TEMP_FILE_PATH, "w") as f:
            json.dump(course_table, f)
           
    elif os.path.isfile(TEMP_FILE_PATH):
        with open(TEMP_FILE_PATH) as f:    
            course_table = json.load(f)
            print "File loaded form temp"
    else:
        print "error"
        return
    result = {}
    for course_entry in course_table:
        new_entry = {}
        try:
            new_entry["instructor"] = course_entry["Instructor"]
            # in case of multiple rooms. The numbwe of entries should match the meeting time
            new_entry["room"] = course_entry["Room"].split('\n') 
            new_entry["name"] = course_entry["Course"]
            time_entry = course_entry["Meeting Time"]
            new_entry["time"] = parse_meeting_time(time_entry) if time_entry != "TBA" else [0, 0, 0, 0, 0]
        except Exception as ex:
            print "crn", ex

        result[course_entry["CRN"]] = new_entry
    print "Finished processing tables" 
    with open("courses.json", 'w') as f:
        json.dump(result, f)
        print "file dumped"

        
if __name__ == "__main__":
    try:
        main()
    except Exception as ex:
        print "ex:", ex
