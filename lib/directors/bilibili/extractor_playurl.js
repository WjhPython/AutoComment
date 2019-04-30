/**
 * http://api.bilibili.com/playurl?aid=15316843
 * 提取时长和字幕接口的接口提取器
 */

const request = require('request-promise');
const uuid = require('uuid/v4');

let Extractor = { };

Extractor.Constant = {
    type:'playurl'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( frame.extractorType != Extractor.Constant.type )
                    return;
                let requestUrl = frame.url;
                let content = await request( requestUrl, { gzip: true, headers:{ 'Cookie':'buvid3=' + uuid() } });
                if( !content )
                    return;
                let root = JSON.parse( content);
                if( !root.cid)
                    return;
                if( !frame.result.duration)
                    frame.result.duration = root.timelength;
                let timeLimit = await director.task.config.get( 'timeLimit' );
                if( timeLimit && frame.result.duration > 600000 )
                    return;
                frame.extractorType = require('./extractor_danmaku').Constant.type;
                frame.url = root.cid;
                result.push( frame );
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