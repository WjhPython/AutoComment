module.exports = {
    matchOneString : function ( str, pattern ) {
        var ra = pattern.exec(str);
        return ra && ra[1];
    },
    queryString : function (url, name) {
        var name_ = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name_ + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent( results[2].replace(/\+/g, " "));
    },
    makeQueryString : function (data) {
        var query = "";
        for( var k in data ) {
            if( data[k] != undefined) {
                query += k;
                query += "=";
                query += encodeURIComponent( data[k]);
                query += "&";
            }
        }
        if( query.length > 0)
            query = query.substr( 0, query.length - 1);
        return query;
    }
};
