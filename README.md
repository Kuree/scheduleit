# ScheduleIt
ScheduleIt is a fast course scheduling web application. It has two main components:
* Back-end scripts crawl college's websites to output ```JSON``` data files. Each school will have two ```JSON``` files, ```search.json``` and ```courses.json```. ```search.json``` is used for search in  ```typeahead.js``` . ```courses.json``` contains all the course information such as time, description, and locations.
* The front-end scheduling algorithm uses bitwise operation on the time slot for each class to detect schedule conflict. It implements a optimized dynamic programming algorithm to ensure its lightening speed.

## How to contribute
Currently only the website only contains Bucknell University's course information. I'm currently working on school selection based on IP address and manually selection. More documents about how to generate ```JSON``` file for other school are coming soon.

## How to run
Any static website host will do. Please notice that in the ```master``` branch, there is no data file for all the classes. Suppose we are using the ```static-sever``` from npm, the following command will help you host it locally:
1. ```$ cd script```
2. ```$ python bucknell.py``` for each schools
3. ``` cd ..```
4. ``` static-server -p 8888 -i index.html``` will host the website at 8888 port

Alternatively, you can checkout ```gh-pages``` branch, which has all the data files.

## Credits
Ninja icon by [Carlo Eduardo Rodríguez Espino](https://www.iconfinder.com/CarloRodriguez)

## License
GPL V2