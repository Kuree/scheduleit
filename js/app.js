String.prototype.endsWith = function(str)
{
    var lastIndex = this.lastIndexOf(str);
    return (lastIndex !== -1) && (lastIndex + str.length === this.length);
}

function guidGenerator() {
    var S4 = function() {
       return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
    };
    return (S4()+S4()+"-"+S4());
}


function schedule(selected_course, courses){
    // create a two dimensional array
    var classes = []
    $.each(selected_course, function(ref_key, entry){
        classes.push(entry);
        // need to check if l exists
        var link_classes = courses[entry[0]].l;
        if(link_classes && Object.keys(link_classes).length > 0){
            $.each(link_classes, function(name, links){
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
            class_entry.push(courses[entry2]);
        });
        available_classes.push(class_entry);
    });
    select_course(current_classes, available_classes, result);
    console.log(result);
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
        if(time1[i] & time2[i] != 0){
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
        return '<p>nope</nopte>';
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
    $.getJSON( "data/bucknell/courses.json", function(data){
        var search_items = [];
        var selected_course = {};
        
        // need to move it to the crawling script
        // eventually it will be or has become the performance bottle-neck
        // $.each(data, function(key, course_entry ) {
        //    var search_tags = course_entry["s"]
        //    if(search_tags[1].endsWith("R") || search_tags[1].endsWith("L")){
        //        return true;
        //    }
        //    $.each(search_tags, function(index, value){
        //        var result = $.grep(search_items, function(e){ return e.n == value; });
        //       if(result.length == 0){
        //            search_items.push({"n" : value, "d" :course_entry["d"], "l" : course_entry["l"],
        //            "crn" : [key]});
        //       }else{
        //            result[0]["crn"].push(key);
        //        }
        //    });
        //});
        
        // download the search_items
        
        // set up typeahead
        $.getJSON("data/bucknell/search.json", function(search_items){
            setup_typeahead(search_items);
        });
        
        handle_selection(selected_course);
        
        
        $(document).on("click", ".remove", function(e){
            var parent = $(e.target).parent();
            var ref = parent.attr("ref");
            // remove the html element
            $( "[ref=" + ref + "]" ).remove();
            // remove it from the selected courses
            delete selected_course[ref];
            
            // testing
            schedule(selected_course, data);
        });
        
    });
    

});


