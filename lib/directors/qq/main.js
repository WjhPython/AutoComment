const BaseType = require('../../director');

let Director = {};

Director.Constant = {
    name: '腾讯视频',
    id: '1ca3559e20dc09bb8dced9e21816c4cc',
    comment: '腾讯采集指导器',
    domains: [
        'qq.com'
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