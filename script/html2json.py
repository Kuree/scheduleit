import requests 
import re
from bs4 import BeautifulSoup

def html_get_text(t):
    return t.get_text().encode("ascii", "ignore").strip()

def main():
    r_dept = requests.get("https://www.banner.bucknell.edu/BANPRD/hwzkschd.P_Bucknell_SchedbyDept")
    r_dept_text = r_dept.text.encode("utf-8")
    pattern = r'value=\"(\w{4})\"'
    dept_search = re.findall(pattern, r_dept_text, re.I)
    # print r_dept_text
    print dept_search
    if dept_search:
        for dept in dept_search:
            payload = {
                'lookopt' : 'DPT',
                'frstopt' : '',
                'term' : '201605',
                'param1' : dept,
                'openopt' : 'ALL'}
            r_form = requests.post("https://www.banner.bucknell.edu/BANPRD/hwzkschd.P_Bucknell_SchedDisplay", 
                    data=payload)
            form_text = r_form.text#.encode("utf-8")
            # TODO:
            # one thing to notice is that even if you query an invalid dept,
            # it will still return status as 200, yet there's no content
            soup = BeautifulSoup(form_text, "lxml")
            table = soup.find("table", attrs = {"id" : "coursetable"})
            # check if it's valid course table
            #if table is None:
            #    continue
            headings = [th.get_text().encode("ascii", "ignore") for th in table.find("tr").find_all("th")]
            datasets = []
            for row in table.find_all("tr")[1:]:
                dataset = zip(headings, (html_get_text(td) for td in row.find_all("td")))
                datasets.append(dataset)
            course_table = []
            for entry in datasets:
                if len(entry) <= 2:
                    continue
                entry_dic = {}
                for x in entry:
                    entry_dic[x[0]] = x[1]
                course_table.append(entry_dic)
            print course_table
            return
            

if __name__ == "__main__":
    main()
