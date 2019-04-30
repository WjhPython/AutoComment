const BaseType = require('../../director');

let Director = {};

Director.Constant = {
    name: 'youtube',
    id: '7c2fff78ab6fa15a1a35f2203062de0c',
    comment: 'youtube采集指导器',
    domains: [
        'youtube.com',
        'youtu.be'
    ]
};
Director.Type = function( ) {
    BaseType.call( this, Director );
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