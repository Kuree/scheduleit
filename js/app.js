// global variables here
class_events = [];
current_class_index = 0;
schedule_result = [];
color_dict = {};
course_description_table = {};



function guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4());
}

function get_class_entry_from_crn(search_items, crn){
    return $.grep( search_items, function( n, i ) {
        return $.inArray(crn, n.crn) != -1;
    });
}

function count_one(x){
    x = (x & (0x55555555)) + ((x >> 1) & (0x55555555));
    x = (x & (0x33333333)) + ((x >> 2) & (0x33333333));
    x = (x & (0x0f0f0f0f)) + ((x >> 4) & (0x0f0f0f0f));
    x = (x & (0x00ff00ff)) + ((x >> 8) & (0x00ff00ff));
    x = (x & (0x0000ffff)) + ((x >> 16) & (0x0000ffff));
    return x;
}

function compare_score(a,b) {
  if (a.score < b.score)
    return 1;
  if (a.score > b.score)
    return -1;
  return 0;
}

function score_schedule(schedule){
    // this checks the morning and evening classes
    
    // flatten the time table
    times = [0, 0, 0, 0, 0]
    for(var i = 0; i < schedule.length; i++){
        var single_class = schedule[i];
        for(var j = 0; j < single_class.t.length; j++){
            times[j] |= single_class.t[j];
        }
    }
    
    var negative_score_mask = 0xFFF00003;
    var negative_score_1 = 0;
    for(var i = 0; i < times.length; i++){
        negative_score_1 += count_one(times[i] & negative_score_mask);
    }
    
    // counting for dis-continuity
    var negative_score_2 = 0;
    var negative_score_2_mask_1 = 5; //(101) check if there is a half hour gap between two classes
    var negative_score_2_mask_2 = 9; // (1001) check if there is an one hour gap between two classes
    for(var i = 0; i < times.length; i++){
        var time = times[i];
        for(var j = 0; j < 32 - 3; j++){
            var mask = negative_score_2_mask_1 << j;
            if((time & mask) == mask){
                negative_score_2++;
            }
        }
        for(var j = 0; j < 32 - 5; j++){
            var mask = negative_score_2_mask_2 << j;
            if((time & mask) == mask){
                negative_score_2++;
            }
        }

    }
    
    var total_negative = negative_score_1 * 5 + negative_score_2 * 5;
    if(total_negative > 100){
        return 5;
    }else{
        return 100 - total_negative;
    }
}

function schedule(selected_course, courses, search_items){
    // create a two dimensional array
    var classes = []
    $.each(selected_course, function(ref_key, entry){
        classes.push(entry);
        // need to check if l exists
        var entries = get_class_entry_from_crn(search_items, entry[0]);
        if(entries.length > 0 && entries[0].l){
            $.each(entries[0].l, function(name, links){
                classes.push(links);
            });
        }            
    });
    var result = [];
    var current_classes = []
    var available_classes = []
    $.each(classes, function(index, entry1){
        var class_entry = [];
        $.each(entry1, function(index2, entry2){
            var entry3 = courses[entry2];
            entry3["crn"] = entry2;
            class_entry.push(entry3);
        });
        available_classes.push(class_entry);
    });
    select_course(current_classes, available_classes, result);
    
    for(var i = 0; i < result.length; i++){
        var entry = result[i];
        entry.score = score_schedule(entry);
    }
    result.sort(compare_score);
    schedule_result = result;
    
    if(schedule_result.length == 0){
        $("#schedule-row").hide("slow");
        $(".footer").show("slow");
        BootstrapDialog.alert({
            type: BootstrapDialog.TYPE_WARNING,
            title: "I'm sorry",
            message: 'There is no available schedule that fits your course selection. Maybe try a different one?',
        }); 
    }
    else{
        current_class_index = 0;
        handle_schedule_render();
    }
}


function handle_schedule_render(){
    $(".footer").fadeOut(500);
    // check all the boundaries
    $("#show-left").prop("disabled",current_class_index == 0);
    $("#show-right").prop("disabled",current_class_index == schedule_result.length - 1);
    
    render_star(schedule_result[current_class_index].score);
    $("#paging").text((current_class_index + 1).toString() + " / " + schedule_result.length.toString());
    
    $("#schedule-row").fadeIn(1500);
    $('#calendar').show('fade',{ queue:false},1500).fullCalendar('render');
    render_schedule(schedule_result[current_class_index]);
        
}

function render_star(score){
    var id = 1
    for(var i = 0; i < score; i+= 20){
        $("#star-" + id.toString()).css({ opacity: 1 }); 
        $("#star-" + id.toString()).css({ width: score.toString() + "%" }); 
    }
}

function render_schedule(classes){
    // clear the old reference. Due to the implementation of fullCalendar, it's very clumsy
    $('#calendar').fullCalendar( 'removeEventSource', class_events);
    // marking classes
    var marked_classes = [];
    for(var i = 0 ; i < classes.length; i++){
        for(var j = 0; j < classes[i].t.length; j++){
            // use a simple state machine here
            var has_class = false;
            var duration_count = 0;
            var first_hit = 0;
            var day = classes[i].t[j];
            for(var k = 0; k < 28; k++){
                if((day & (1 << k)) != 0){
                    // has class here
                    if(!has_class){
                        first_hit = k;
                        has_class = true;
                    }
                    duration_count += 1
                }else{
                    if(has_class){
                        // a class ends
                        has_class = false;
                        marked_classes.push({"n" : classes[i].n, "i" : i, 'crn' : classes[i].crn, "day": j, "duration" : duration_count, "start" : first_hit});
                        duration_count = 0;
                    }
                }
            }
            
            // if it finishes at the ends
            if(has_class){
                marked_classes.push({"n" : classes[i].n, "i" : i, 'crn' : classes.crn, "day": j, "duration" : duration_count, "start" : first_hit});
            }
        }
    }
    
    class_events.length = 0;
    
    for(var i = 0; i < marked_classes.length; i++){
        var marked_class = marked_classes[i];
        var start_time = moment().startOf('isoweek').add(marked_class.day, "d").add(8, "h").add(marked_class.start * 30, "m");
        var class_entry = {
            "title" : marked_class.n,
            "start" : start_time,
            "allDay" : false,
            "end" : moment().startOf('isoweek').add(marked_class.day, "d").add(8, "h").add((marked_class.start+marked_class.duration) * 30 - 5, "m")
        }
        class_events.push(class_entry);
    }
    
    $('#calendar').fullCalendar( 'addEventSource', class_events);
}

function copy_array(old_array){
    // this does shallow copy of an array
    var result = [];
    for(var i = 0; i < old_array.length; i++){
        result.push(old_array[i]);
    }
    return result;
}

// this is recursive call with dynamic programming fashion
function select_course(current_classes, remaining_classes, result){
    if(remaining_classes.length == 0){
        // a valid choice
        result.push(copy_array(current_classes));
        return;
    }
    
    // choose the next class
    var next_class = remaining_classes[0];
    for(var i = 0; i < next_class.length; i++){
        // choose one by one
        var choice = next_class[i];
        
        // check for conflict
        if(!is_new_class_conflicted(current_classes, choice)){
            // add it to the current list
            // and remove the next class from the remaining_classes
            current_classes.push(choice)
            remaining_classes.shift();
            // call the function recursively
            select_course(current_classes, remaining_classes, result);
            // reset the state
            current_classes.pop();
            remaining_classes.unshift(next_class);
        }
        
    }
}

function is_single_class_conflicted(class1, class2){
    var time1 = class1.t;
    var time2 = class2.t;
    for(var i = 0; i < 5; i++){
        if((time1[i] & time2[i]) != 0){
            return true;
        }
    }
    return false;
}

function is_new_class_conflicted(classes, new_class){
    for(var i = 0; i < classes.length; i++){
        if(is_single_class_conflicted(classes[i], new_class)){
            return true;
        }
    }
    return false;
}

function setup_typeahead(search_items, tag_items){
    
    var courses = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.obj.whitespace('n'),
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: search_items    
    });
    $('#search .typeahead').typeahead(null,      
    {
        name: 'bucknell-courses',
        source: courses.ttAdapter(),
        displayKey: function(e) { if(e.nn){return "nn";} else{ return "n";}},
        templates: {
            empty: [
              '<div class="empty-message">',
                'Unable to find any courses that match the query',
              '</div>'
            ].join('\n'),
            suggestion: function(e) { return create_description(e, search_items)}
        },
        limit: 100
    });
}



function create_description(e, search_items){
    if(e.d){
        return '<div><strong>' + e.n + ': ' + e.ti +  '</strong> <br> ' + e.d + '</div>';
    }
    else{
        // need to pull it out from search
        if(e.nn){
        }
        var entries = get_class_entry_from_crn(search_items, e.n);
        var entry;
        for(var i = 0; i < entries.length; i++){
            entry = entries[i];
            if(entry.d){
                break;
            }
        }
        return '<div><strong>' + e.n + ': ' + entry.ti +  '</strong> <br> ' + entry.d + '</div>';
    }
}


function handle_selection(selected_course){
    $('#search .typeahead').bind('typeahead:select', function(ev, suggestion) {
        // use handlebar to compile
        var random_id = guidGenerator();
        var html_main = '<span class="tag label label-info" ref="' + random_id + '">\
<span>' + suggestion.n + '</span>\
<a class="remove fa fa-times"></a> \
</span>';

        $(html_main).appendTo($('#course-selection')).hide().fadeIn(600);
        
        // handle linked courses
        if(suggestion.l && Object.keys(suggestion.l).length > 0){
            $.each(suggestion.l, function(key, value){
                var tooltip = suggestion.n + " requires " + key;
                var link_html = '<span class="tag label label-info" data-toggle="tooltip" data-placement="bottom" title="' + tooltip + '" ref="' + random_id + '">' + key + '</span>';
                $(link_html).appendTo($('#course-selection')).hide().fadeIn(600);
                $('[data-toggle="tooltip"]').tooltip();
            });
        }
        
        // add it to the selected courses
        selected_course[random_id] = suggestion.crn;
        
        // clear the search input
        $('.typeahead').typeahead('val', '');
    });
}

function generate_course_desp(course_name){
    var entry;
    var crn;
    if (isNaN(course_name)){
        // actual course name
        // this way is proven to be faster than $.grep
        for(var key in course_description_table){
            entry = course_description_table[key];
            if(entry.n == course_name){
                crn = key;
                break;
            }
        }
        
    }else{
        entry = course_description_table[course_name];
        crn = course_name;
        
    }   
    return "<p><b>Instructor: </b>" + entry.i + "</p>" +
                "<p><b>Location: </b>" + (entry.r == "" ? "TBA" : entry.r) + "</p>" + 
                "<p><b>CRN: </b>" + crn + "</p>";
}

function create_tag_desc(desc_table, tags, ccc){
    var list = tags[ccc];
    var result = "";
    for(var i = 0; i < list.length; i++){
        var entry = list[i];
        for(var j = 0; j < desc_table.length; j++){
            var class_entry = desc_table[j];
            if(class_entry.n === entry){
                result += '<p><b>' + entry + ' </b>' + class_entry.ti + ": " + class_entry.d.split(".")[0] + '.</p>';
            }
        }
    }
    return result;
}

function create_tour(){
    // Instance the tour
    var tour = new Tour({
      steps: [
      {
        element: "#toggle-tag-search",
        title: "Quick requirement lookup",
        content: "Click here to look up all the requirement-related courses"
      },
      {
        element: "#search-box",
        title: "Search courses",
        content: "Type the course name or CRN here to add your class to the search list"
      },
      {
        element: "#toggle-web-tour",
        title: "Web tour",
        content: "Click here to toggle the web tour again."
      }
      
    ]});
    
    tour.init();
}

$(function(){    
    // download the search_items
    var search_list = [];
    $('#calendar').fullCalendar({
        weekends: false, // will hide Saturdays and Sundays
        header: {left:"", right: ''},
        defaultView : "agendaWeek",
        columnFormat : "ddd",
        defaultDate : moment().startOf('isoweek'), // just start from Monday
        allDaySlot : false,
        minTime: "8:00:00",
        maxTime : "22:00:00",
        displayEventTime : false,
        windowResize: function(view) {
                        if ($(window).width() < 300){
                            $('#calendar').fullCalendar( 'changeView', 'basicWeek' );
                            
                        } else {
                            $('#calendar').fullCalendar( 'changeView', 'agendaWeek' );
                        }
                    },
            eventClick: function(calEvent, jsEvent, view) {

                var course_name = calEvent.title;
                BootstrapDialog.alert({
                    title: course_name,
                    message: generate_course_desp(course_name)
                });


            }
    });
    $('#calendar').fullCalendar( 'addEventSource', class_events);

    
    $(document).on("click", ".remove", function(e){
            var parent = $(e.target).parent();
            var ref = parent.attr("ref");
            // remove the html element
            $( "[ref=" + ref + "]" ).hide().remove();
            
            // remove it from the selected courses
            delete selected_course[ref];
        });
    
    $.getJSON("data/bucknell/search.json", function(search_items){
        $('#tag-search-modal').on('show.bs.modal', function (e) {
        // first time
        var isEmpty = $("#tag-content").html() === "";
        if(isEmpty) {
            $.getJSON("data/bucknell/tag.json", function(tags){
                for(var ccc in tags){
                    $("#sidebar").append('<li><a ref=tag-search>' + ccc + '</a></li>');

                }
                $("[ref=tag-search]").click(function(e){
                    var tag = $(e.target).text();
                    var p = create_tag_desc(search_items, tags, tag);
                    $("#tag-content").empty();
                    $(p).appendTo($('#tag-content')).hide().show(500);
                });
                var p = create_tag_desc(search_items, tags, ccc);
                $("#tag-content").empty();
                $(p).appendTo($('#tag-content')).hide().show(500);
                
            });
        }
    })
        
        setup_typeahead(search_items);
        search_list = search_items;        
    });
    
    $.getJSON( "data/bucknell/courses.json", function(data){
        selected_course = {};        
        handle_selection(selected_course);
        
        course_description_table = data;
        
        $('#search-button').click(function(){
            if(Object.keys(selected_course).length == 0){
                BootstrapDialog.alert({
                    type: BootstrapDialog.TYPE_WARNING,
                    title: "Warning",
                    message: 'Please select as least one course to schedule.',
                }); 
                
            }
            else{
                schedule(selected_course, data, search_list);
            }
        });
        
    });
    
    $("#show-left").click(function(){
        current_class_index--;
        handle_schedule_render();
    });
    
    $("#show-right").click(function(){
        current_class_index++;
        handle_schedule_render();
    });
    

    
    $("#download").click(function(){
        var classes = schedule_result[current_class_index];
        url = "download.html?";
        for(var i = 0; i < classes.length; i++){
            var key = classes[i].crn;
            url += key + "=" + key + "&"
        }
        
        url = url.substring(0, url.length - 1);
        console.log(url);
        $('#download-modal').on('show.bs.modal', function () {
            $('#download-iframe').attr("src",url);
             
        });
        $('#download-modal').modal('show');
    });
    
    $("#toggle-tag-search").click(function(){
        $("#tag-search-modal").modal('toggle');
    });
    
    //var tour = create_tour();
    //$("#toggle-web-tour").click(function(){
    //    tour.start();
    //});
    
    $('[data-toggle="tooltip"]').tooltip(); 
});


