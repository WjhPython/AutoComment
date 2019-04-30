/**
 * http://v.qq.com/vplus/baozoumanhua/videos
 * 作者视频列表页提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'vplus'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( !/\/vplus\/.*?\/videos/.test(frame.url))
                    return;
                let content = await request(frame.url, { gzip: true } );
                if( !content)
                    return;
                let euid = (/visited_euin\s*?:\s*?'(.*?)'/.exec( content)||[])[1];
                if( !euid)
                    return;
                let nick = (/nick\s*?:\s*?"(.*?)"/.exec( content)||[])[1];
                let avatar = (/avatar\s*?:\s*?"(.*?)"/.exec( content)||[])[1];
                await director.task.config.set( 'timeLimit', true );
                result.push({
                    type:'extractor',
                    extractorType: require('./extractor_vpluse_list').Constant.type,
                    url:'http://c.v.qq.com/vchannelinfo?otype=json&uin=' + euid + '&qm=1&num=24',
                    local: {
                        page:1
                    },
                    result: {
                        userId: require("md5")( 'qq-userid-' + euid ),
                        nick: nick,
                        face: avatar
                    }
                });
            } catch (error) {
                console.log( error);
                reject(error);
            } finally {
                resolve( result );
            }
        });
    };
}

module.exports = Extractor;