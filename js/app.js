String.prototype.endsWith = function(str)
{
    var lastIndex = this.lastIndexOf(str);
    return (lastIndex !== -1) && (lastIndex + str.length === this.length);
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
                    search_items.push({"n" : value, "d" :course_entry["d"]});
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
            var rawTemplate = '<span class="tag label label-info">\
<span>{{n}}</span>\
<a><i class="remove glyphicon glyphicon-remove-sign glyphicon-white"></i></a> \
</span>';
            var compiledTemplate = Handlebars.compile(rawTemplate);
            var html = compiledTemplate(suggestion);
            $('#course-selection').append(html);
            // clear the search input
            $('.typeahead').typeahead('val', '');
        });
    });
      
    
});