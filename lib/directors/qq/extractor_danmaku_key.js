/**
 * https://mfm.video.qq.com/danmu?otype=json&callback=jQuery191008470125444805543_1507805305733&timestamp=0&target_id=2139204055&count=80&second_count=6&session_key=0%2C0%2C0&_=1507805305769
 * 视频弹幕提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'danmaku_key'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( frame.extractorType != Extractor.Constant.type)
                    return;
                content = await request( frame.url , { gzip: true } );
                if( !content )
                    return;
                content = content.substring( 13, content.length-1 );
                let root = JSON.parse( content);
                if( !root.targetid )
                    return;
                frame.extractorType = require('./extractor_danmaku').Constant.type;
                frame.url = 'https://mfm.video.qq.com/danmu?count=80&second_count=6&target_id=' + root.targetid;
                result.push( frame);
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