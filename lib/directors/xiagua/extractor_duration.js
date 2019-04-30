/**
 * http://ib.365yg.com/video/urls/v/1/toutiao/mp4/804ba4a85bfe452e883cde80ce4dd778?r=08627267466432209&s=1042986177
 * 视频时长提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'duration'
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
                if( root.message != 'success' )
                    return;
                if( !frame.result )
                    frame.result = {};

                let timeLimit = await director.task.config.get( 'timeLimit' );
                if( timeLimit && root.data.video_duration > 600)
                    return;
                
                frame.result.duration = root.data.video_duration*1000;
                frame.type = 'extractor';
                frame.extractorType = require('./extractor_danmaku').Constant.type;
                frame.url = 'http://www.ixigua.com/api/comment/list/?group_id=' + frame.local.groupId + '&item_id=' + frame.local.itemId;

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