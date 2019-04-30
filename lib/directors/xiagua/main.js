const BaseType = require('../../director');

let Director = {};

Director.Constant = {
    name: '西瓜视频',
    id: '759e1d9690da97ca7d495020ed36014c',
    comment: 'ixigua采集指导器',
    domains: [
        'ixigua.com'
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
