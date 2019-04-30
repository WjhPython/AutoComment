/**
 * http://v.qq.com/vplus/baozoumanhua/videos
 * 作者视频列表页提取器
 */

const request = require('request-promise');

let Extractor = { };

Extractor.Constant = {
    type:'vplus_list'
};

Extractor.Class = function() {
    require('../../extractor').call( this );
    this.go = ( frame, director ) => {
        return new Promise( async (resolve, reject) => {
            let result = [];
            try {
                if( frame.extractorType != Extractor.Constant.type)
                    return;
                if( !frame.local.page)
                    return;
                let requestUrl = frame.url + '&pagenum=' + frame.local.page;
                let content = await request( requestUrl, { gzip: true } );
                if( !content )
                    return;
                content = content.substring(13, content.length-1);
                let root = JSON.parse( content);
                let archives = root.videolst;
                if( !archives || archives.length == 0 )
                    return;
                let timeLimit = await director.task.config.get( 'timeLimit' );
                for( let arch of archives ) {
                    if( arch.duration ) {
                        let dur = arch.duration.split(':');
                        if( dur.length != 2)
                            continue;
                        if( timeLimit && parseInt(dur[0]) * 60 + parseInt(dur[1]) > 600)
                            continue;
                    }
                    result.unshift( {
                        type:'extractor',
                        extractorType: require('./extractor_video').Constant.type,
                        url:arch.url,
                        result:(frame.result || { })
                    } );
                }
                
                frame.local.page++;
                result.unshift( frame );
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