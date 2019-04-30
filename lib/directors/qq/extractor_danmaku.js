/**
 * https://mfm.video.qq.com/danmu?otype=json&callback=jQuery191008470125444805543_1507805305733&timestamp=0&target_id=2139204055&count=80&second_count=6&session_key=0%2C0%2C0&_=1507805305769
 * 视频弹幕提取器
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
                let timeEnd = frame.result.duration/1000;
                let timestamp = 15;
                while( timestamp < timeEnd ) {
                    try {
                        let danmakuUrl = frame.url + '&timestamp=' + timestamp;
                        let content = await request( danmakuUrl , { gzip: true } );
                        if( !content )
                            return;
                        let root = JSON.parse(content);
                        if( root.err_code != 0 )
                            return;
                        let danmaku = root.comments;
                        if( danmaku ) {
                            for( let d of danmaku ) {
                                frame.result.danmaku.push(
                                    {
                                        t:d.timepoint * 1000 + parseInt( Math.random()*1000 ),
                                        c:d.content
                                    }
                                );
                            }
                        }
                    } catch (error) {
                        
                    }
                    timestamp += 30;
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