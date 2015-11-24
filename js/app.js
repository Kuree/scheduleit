$(function() {
    $.getJSON( "data/bucknell/search.json", function( data ) {
        //var items = [];
        var courses = new Bloodhound({
            datumTokenizer: Bloodhound.tokenizers.whitespace,
            queryTokenizer: Bloodhound.tokenizers.whitespace,
            local: data     
        });
        $('#search .typeahead').typeahead(null,      
        {
            name: 'bucknell-courses',
            source: courses,
            limit: 10
        });
    });
      
    
});