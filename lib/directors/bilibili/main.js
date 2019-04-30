let Director = {};

Director.Constant = {
    name: '哔哩哔哩',
    id: 'f9baca278ca208f229174e79530a56c8',
    comment: 'bilibili采集指导器',
    domains: [
        'bilibili.com'
    ]
};
Director.Type = function( ) {
    require('../../director').call( this, Director );
    this.check = ( result ) => {
        if( !result.uid ||
            !result.sourceUrl ||
            !result.pic ||
            !result.title ||
            !result.userId ||
            !result.nick ||
            !result.face ||
            !result.createTime ||
            !result.duration ||
            !result.siteName )
            return false;
        return true;
    }
};

module.exports = Director;