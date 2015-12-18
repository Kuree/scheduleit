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
        // use handlebar to compile
        var random_id = guidGenerator();
        var html_main = '<span class="tag label label-info" ref="' + random_id + '">\
<span>' + suggestion.n + '</span>\
<a class="remove glyphicon glyphicon-remove-sign glyphicon-white"></a> \
</span>';
        $('#course-selection').append(html_main);
        
        // handle linked courses
        if(suggestion.l && Object.keys(suggestion.l).length > 0){
            $.each(suggestion.l, function(key, value){
                var tooltip = suggestion.n + " requires " + key;
                var link_html = '<span class="tag label label-info" data-toggle="tooltip" data-placement="bottom" title="' + tooltip + '" ref="' + random_id + '">' + key + '</span>'
                $('#course-selection').append(link_html);
                $('[data-toggle="tooltip"]').tooltip()
            });
        }
        
        // add it to the selected courses
        selected_course[random_id] = suggestion.crn;
        
        // clear the search input
        $('.typeahead').typeahead('val', '');
    });
}


$(function(){    
    // download the search_items
    var search_list = [];
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
    $('#calendar').fullCalendar( 'addEventSource', class_events);
    
    $.getJSON("data/bucknell/search.json", function(search_items){
        setup_typeahead(search_items);
        search_list = search_items;
    });
    
    $.getJSON( "data/bucknell/courses.json", function(data){
        var selected_course = {};        
        handle_selection(selected_course);
        
        $(document).on("click", ".remove", function(e){
            var parent = $(e.target).parent();
            var ref = parent.attr("ref");
            // remove the html element
            $( "[ref=" + ref + "]" ).remove();
            // remove it from the selected courses
            delete selected_course[ref];
        });
        
        $('#search-button').click(function(){
            schedule(selected_course, data, search_list);
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


