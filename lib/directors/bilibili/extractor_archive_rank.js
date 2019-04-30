/**
 * http://api.bilibili.com/archive_rank/getarchiverankbypartion?type=json&tid=
 * http://api.bilibili.com/x/tag/ranking/archives?jsonp=jsonp&tag_id=453950&rid=138&ps=20&pn=1&callback=jQuery17208858784438551317_1507781333788&_=1507781333970
 * 视频列表接口提取器
 */
const request = require('request-promise');
let Extractor = { };

Extractor.Constant = {
    type:'archive_rank'
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
                let requestUrl = frame.url + '&pn=' + frame.local.page;
                let content = await request( requestUrl, { gzip: true } );
                if( !content )
                    return;
                let root = JSON.parse( content);
                if( root.code != 0)
                    return;
                let archives = root.data.archives;
                if( !archives || archives.length == 0 )
                    return;

                let timeLimit = await director.task.config.get( 'timeLimit' );
                for( let arch of archives ) {
                    if( timeLimit && arch.duration > 600 )
                        continue;
                    let newFrame = {
                        type:'extractor',
                        extractorType: require('./extractor_video').Constant.type,
                        url:'http://www.bilibili.com/video/av' + arch.aid,
                        result:{
                            sourceUrl:'http://www.bilibili.com/video/av' + arch.aid,
                            pic:arch.pic,
                            title:arch.title,
                            nick:arch.author,
                            face:arch.face,
                            createTime:new Date(arch.create),
                            duration:arch.duration*1000,
                            siteName:'bilibili',
                            danmaku:[]
                        },
                        local:{
                            aid:arch.aid
                        }
                    };

                    result.unshift( newFrame );
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