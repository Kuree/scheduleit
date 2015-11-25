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
    });
      
    
});