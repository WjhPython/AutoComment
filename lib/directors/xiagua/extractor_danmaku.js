/**
 * http://www.bilibili.com/video/av3441899/
 * 视频评论提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'danmaku'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( frame.extractorType != Extractor.Constant.type)
                    return;
                let content = await request( frame.url , { gzip: true } );
                if( !content )
                    return;
                let root = JSON.parse(content);
                if( root.message != 'success')
                    return;

                let danmaku = root.data.comments;
                if( danmaku ) {
                    for( let d of danmaku ) {
                        frame.result.danmaku.push(
                            {
                                t:parseInt((frame.result.duration-1)*Math.random()),
                                c:d.text
                            }
                        );
                    }
                }
                frame.type = 'result';
                result.push(frame);
            } catch (error) {
                console.log( error);
                reject(error);
            } finally {
                resolve( result);
            }
        });
    };
}

module.exports = Extractor;