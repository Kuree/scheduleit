// global variables here
class_events = [];
current_class_index = 0;
schedule_result = [];

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
            times[i] |= single_class.t[j];
        }
    }
    
    var negative_score_mask = 0xC0000FFF;
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
            if((time & (negative_score_2_mask_1 << j)) == time && time != 0){
                negative_score_2++;
            }
        }
        for(var j = 0; j < 32 - 5; j++){
            if((time & (negative_score_2_mask_2 << j)) == time && time != 0){
                negative_score_2++;
            }
        }

    }
    
    var total_negative = negative_score_1 * 10 + negative_score_2 * 5;
    if(total_negative > 100){
        return 0;
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
    
    // TODO:
    // fix no result found
    current_class_index = 0;
    handle_schedule_render();
}


function handle_schedule_render(){
    // check all the boundaries
    $("#show-left").prop("disabled",current_class_index == 0);
    $("#show-right").prop("disabled",current_class_index == schedule_result.length - 1);
    render_schedule(schedule_result[current_class_index]);
    render_star(schedule_result[current_class_index].score);
}

function render_star(score){
    var html = ""
    for(var i = 0; i < 100; i += 20){
        if(score > i){
            html += '<i class="glyphicon glyphicon-star"></i>';
        }else{
            html += '<i class="glyphicon glyphicon-star-empty"></i>';
        }
    }
    
    $("#rating-star").empty().append(html);
    
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
    
    var colors = Please.make_color({
        colors_returned: classes.length,
        format: ("rgb-string"),
        
    });
    
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
    console.log(class_events);
    
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

function setup_typeahead(search_items){
    var courses = new Bloodhound({
        datumTokenizer: Bloodhound.tokenizers.obj.whitespace('n'),
        queryTokenizer: Bloodhound.tokenizers.whitespace,
        local: search_items    
    });
    $('#search .typeahead').typeahead(null,      
    {
        name: 'bucknell-courses',
        source: courses.ttAdapter(),
        limit: 5,
        displayKey: "n",
        templates: {
            empty: [
              '<div class="empty-message">',
                'Unable to find any courses that match the query',
              '</div>'
            ].join('\n'),
            suggestion: function(e) { return create_description(e, search_items)}
        }
    });
}

function create_description(e, search_items){
    if(e.d){
        return '<div><strong>' + e.n + ': ' + e.ti +  '</strong> <br> ' + e.d + '</div>';
    }
    else{
        // need to pull it out from search
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
        suggestion.has_close = true;
        v_input.selected_course.push(suggestion);
        // handle linked courses
        if(suggestion.l && Object.keys(suggestion.l).length > 0){
            $.each(suggestion.l, function(key, value){
                selected_course.push({n : key, has_close : false, tag : suggestion.n});
            });
        }
        
        // add it to the selected courses
        // v_schedule.selected_course.push(suggestion.crn);
        
        // clear the search input
        $('.typeahead').typeahead('val', '');
    });
}


$(function(){    
    // initialize the vue js instance
    var input_data = {search_list : [], selected_course : []};
    v_input = new Vue({
        el: '#course-selection',
        data: input_data
    })
    
    var schedule_data = {class_events : [], current_class_index : 0, schedule_result : []}
    
    v_schedule = new Vue({
        el: "#schedule-row",
        data: schedule_data
    });

    
    // set up the calendar
    $('#calendar').fullCalendar({
        weekends: false, // will hide Saturdays and Sundays
        header: {left:"", right: ''},
        defaultView : "agendaWeek",
        columnFormat : "dddd",
        defaultDate : moment().startOf('isoweek'), // just start from Monday
        allDaySlot : false,
        minTime: "8:00:00",
        maxTime : "22:00:00",
        displayEventTime : false
    });
    $('#calendar').fullCalendar( 'addEventSource', schedule_data.class_events);
    
    // download the search_items
    $.getJSON("data/bucknell/search.json", function(search_items){
        setup_typeahead(search_items);
        input_data.search_list = search_items;
    });
    
    $.getJSON( "data/bucknell/courses.json", function(json_data){
        handle_selection(input_data.selected_course);
        
        $(document).on("click", ".remove", function(e){
            var parent = $(e.target).parent();
            var ref = parent.attr("ref");
            // remove the html element
            $( "[ref=" + ref + "]" ).remove();
            // remove it from the selected courses
            delete input_data.selected_course[ref];
        });
        
        $('#search-button').click(function(){
            schedule(input_data.selected_course, json_data, input_data.search_list);
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
    

});


