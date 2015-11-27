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

$(function(){
    $.getJSON( "data/bucknell/courses.json", function(data){
        var search_items = [];
        $.each(data, function(index, course_entry ) {
            var search_tags = course_entry["s"]
            if(search_tags[1].endsWith("R") || search_tags[1].endsWith("L")){
                return true;
            }
            $.each(search_tags, function(index, value){
                
                if(!(search_items[value])){
                    search_items.push({"n" : value, "d" :course_entry["d"], "l" : course_entry["l"]});
                }
            });
        });
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
            suggestion: Handlebars.compile('<div><strong>{{n}}</strong> <br> {{d}}</div>')
            }
        });
        
        $('#search .typeahead').bind('typeahead:select', function(ev, suggestion) {
            // use handlebar to compile
            var random_id = guidGenerator();
            var rawTemplate = '<span class="tag label label-info" ref="' + random_id + '">\
<span>{{n}}</span>\
<a class="remove glyphicon glyphicon-remove-sign glyphicon-white"></a> \
</span>';
            var compiledTemplate = Handlebars.compile(rawTemplate);
            var html_main = compiledTemplate(suggestion);
            $('#course-selection').append(html_main);
            
            // handle linked courses
            if(Object.keys(suggestion.l).length > 0){
                $.each(suggestion.l, function(key, value){
                    var tooltip = suggestion.n + " requires " + key;
                    var link_template = '<span class="tag label label-info" data-toggle="tooltip" data-placement="bottom" title="' + tooltip + '" ref="' + random_id + '">' + key + '</span>'
                    $('#course-selection').append(link_template);
                    $('[data-toggle="tooltip"]').tooltip()
                });
                
            }
            
            // clear the search input
            $('.typeahead').typeahead('val', '');
        });
    });
    
    $(document).on("click", ".remove", function(e){
        var parent = $(e.target).parent();
        var ref = parent.attr("ref");
        $( "[ref=" + ref + "]" ).remove();
    });
});


